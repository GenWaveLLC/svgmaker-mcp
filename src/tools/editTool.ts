import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
    CallToolRequestSchema,
    ListToolsRequestSchema,
    TextContent 
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';

const EditToolInputSchema = z.object({
    input_path: z.string().min(1, "Input path cannot be empty. Must be an absolute path to the image file."),
    prompt: z.string().min(1, "Prompt cannot be empty."),
    output_path: z.string().min(1, "Output path cannot be empty."),
    quality: z.enum(['low', 'medium', 'high']).optional().describe("Quality level - affects aspect ratio: low/medium use 'auto', high uses 'square'"),
    aspectRatio: z.enum(['auto', 'portrait', 'landscape', 'square']).optional().describe("Aspect ratio for the edited SVG"),
    background: z.enum(['auto', 'transparent', 'opaque']).optional().describe("Background type"),
});

export function registerEditTool(server: Server) {
    // Register the list tools handler if not already registered
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "svgmaker_edit",
                    description: "Edits an existing image/SVG file based on a text prompt using SVGMaker API and saves it to a specified local path.",
                    inputSchema: zodToJsonSchema(EditToolInputSchema),
                }
            ]
        };
    });

    // Register the call tool handler if not already registered
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        
        if (name !== "svgmaker_edit") {
            throw new Error(`Unknown tool: ${name}`);
        }

        try {
            const validatedArgs = EditToolInputSchema.parse(args);
            
            // Note: In a real implementation, we'd need to get roots from the client
            // For now, we'll use a simple path validation
            const clientRoots: any[] = []; // server.getRoots() is not available in this SDK version
            const validatedInputPath = await fileUtils.resolveAndValidatePath(validatedArgs.input_path, clientRoots, 'read');
            const validatedOutputPath = await fileUtils.resolveAndValidatePath(validatedArgs.output_path, clientRoots, 'write');

            // Read the input file
            const inputImage = await fileUtils.readFileToBuffer(validatedInputPath);

            // Determine aspect ratio based on quality and explicit aspectRatio
            let finalAspectRatio = validatedArgs.aspectRatio;
            if (!finalAspectRatio) {
                if (validatedArgs.quality === 'high') {
                    finalAspectRatio = 'square';
                } else {
                    finalAspectRatio = 'auto' as any; // low and medium use auto
                }
            }

            const sdkParams = {
                image: inputImage,
                prompt: validatedArgs.prompt,
                quality: validatedArgs.quality,
                aspectRatio: finalAspectRatio,
                background: validatedArgs.background,
                svgText: true,
            };

            const result = await svgmakerService.editSVG(sdkParams as any);

            if (result.svgText) {
                await fileUtils.writeFile(validatedOutputPath, result.svgText);
                return {
                    content: [{ type: 'text', text: `SVG edited successfully: ${validatedOutputPath}` } as TextContent]
                };
            } else {
                throw new Error("SVGMaker API did not return SVG content.");
            }
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error editing SVG: ${error.message}` } as TextContent]
            };
        }
    });
}
