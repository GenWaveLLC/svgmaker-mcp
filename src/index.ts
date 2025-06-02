#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { initializeSvgmakerService } from './services/svgmakerService.js';
import { registerGenerateTool } from './tools/generateTool.js';

// Load environment variables
dotenv.config();

async function main() {
    const apiKey = process.env.SVGMMAKER_API_KEY;
    if (!apiKey) {
        process.exit(1);
    }

    // Initialize the MCP server
    const server = new Server(
        {
            name: "svgmaker-server",
            version: "0.1.0",
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // Initialize SVGMaker Service
    initializeSvgmakerService(apiKey, process.env.SVGMMAKER_RATE_LIMIT_RPM, process.env.SVGMMAKER_BASE_URL);

    // Set up tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "svgmaker_generate",
                    description: "Generates an SVG image from a text prompt using SVGMaker API and saves it to a specified local path.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "Text prompt for SVG generation"
                            },
                            output_path: {
                                type: "string",
                                description: "Local file path where the SVG will be saved"
                            },
                            quality: {
                                type: "string",
                                enum: ["low", "medium", "high"],
                                description: "Quality level - affects aspect ratio: low/medium use 'auto', high uses 'square'"
                            },
                            aspectRatio: {
                                type: "string",
                                enum: ["square", "portrait", "landscape"],
                                description: "Aspect ratio for the generated SVG"
                            }
                        },
                        required: ["prompt", "output_path"]
                    }
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        
        if (name !== "svgmaker_generate") {
            throw new Error(`Unknown tool: ${name}`);
        }

        try {
            // Ensure args exists
            if (!args) {
                throw new Error("No arguments provided");
            }
            
            // Simple validation
            if (!args.prompt || typeof args.prompt !== 'string') {
                throw new Error("Prompt is required and must be a string");
            }
            if (!args.output_path || typeof args.output_path !== 'string') {
                throw new Error("Output path is required and must be a string");
            }

            // Basic path validation (simplified for now)
            const outputPath = args.output_path as string;
            if (!outputPath.endsWith('.svg')) {
                throw new Error("Output path must end with .svg extension");
            }

            // Determine aspect ratio based on quality and explicit aspectRatio
            let finalAspectRatio = args.aspectRatio as string;
            if (!finalAspectRatio) {
                if (args.quality === 'high') {
                    finalAspectRatio = 'square';
                } else {
                    finalAspectRatio = 'auto';
                }
            }

            const sdkParams = {
                prompt: args.prompt as string,
                quality: args.quality as string,
                aspectRatio: finalAspectRatio,
                svgText: true,
            };

            // Import the service function dynamically to avoid circular imports
            const { generateSVG } = await import('./services/svgmakerService.js');
            const result = await generateSVG(sdkParams as any);

            if (result.svgText) {
                // Import file utils and validate path
                const { writeFile, resolveAndValidatePath } = await import('./utils/fileUtils.js');
                const validatedPath = await resolveAndValidatePath(outputPath, [], 'write');
                await writeFile(validatedPath, result.svgText);
                
                return {
                    content: [{
                        type: 'text',
                        text: `SVG generated successfully and saved to: ${validatedPath}`
                    }]
                };
            } else {
                throw new Error("SVGMaker API did not return SVG content.");
            }
        } catch (error: any) {
            return {
                isError: true,
                content: [{ 
                    type: 'text', 
                    text: `Error generating SVG: ${error.message}` 
                }]
            };
        }
    });

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        await server.close();
        process.exit(0);
    });
}

main().catch(error => {
    process.exit(1);
});