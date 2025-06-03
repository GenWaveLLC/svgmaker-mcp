import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
    CallToolRequestSchema,
    ListToolsRequestSchema,
    TextContent,
    RequestMeta
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';

const ConvertToolInputSchema = z.object({
    input_path: z.string().min(1, "Input path cannot be empty. Must be an absolute path to the image file."),
    output_path: z.string().min(1, "Output path cannot be empty."),
});

export function registerConvertTool(server: Server) {
    // Register the list tools handler if not already registered
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "svgmaker_convert",
                    description: "Converts an image file to SVG format using SVGMaker API and saves it to a specified local path.",
                    inputSchema: zodToJsonSchema(ConvertToolInputSchema),
                }
            ]
        };
    });

    // Register the call tool handler if not already registered
    server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }) => {
        const { name, arguments: args } = request.params;
        
        if (name !== "svgmaker_convert") {
            throw new Error(`Unknown tool: ${name}`);
        }

        try {
            const validatedArgs = ConvertToolInputSchema.parse(args);
            
            // Note: In a real implementation, we'd need to get roots from the client
            // For now, we'll use a simple path validation
            const clientRoots: any[] = []; // server.getRoots() is not available in this SDK version
            const validatedInputPath = await fileUtils.resolveAndValidatePath(validatedArgs.input_path, clientRoots, 'read');
            const validatedOutputPath = await fileUtils.resolveAndValidatePath(validatedArgs.output_path, clientRoots, 'write');

            // Read the input file
            const inputImage = await fileUtils.readFileToBuffer(validatedInputPath);

            // Send initial progress
            if (request.params._meta?.progressToken) {
                (server as any).sendProgress(request.params._meta.progressToken, {
                    content: [{ type: 'text', text: 'Starting image conversion...' }],
                    percentage: 0
                });
            }

            // Start progress updates every 5 seconds
            let currentProgress = 0;
            const progressInterval = setInterval(() => {
                if (request.params._meta?.progressToken && currentProgress < 95) {
                    currentProgress += 25;
                    (server as any).sendProgress(request.params._meta.progressToken, {
                        content: [{ type: 'text', text: `Converting image... ${currentProgress}%` }],
                        percentage: currentProgress
                    });
                }
            }, 5000);

            try {
                const sdkParams = {
                    file: inputImage,
                    svgText: true,
                };

                // The actual API call remains non-streaming
                const result = await svgmakerService.convertImageToSVG(sdkParams as any);

                // Send completion progress
                if (request.params._meta?.progressToken) {
                    (server as any).sendProgress(request.params._meta.progressToken, {
                        content: [{ type: 'text', text: 'Image conversion complete!' }],
                        percentage: 100
                    });
                }

                if (result.svgText) {
                await fileUtils.writeFile(validatedOutputPath, result.svgText);
                return {
                    content: [{ type: 'text', text: `Image converted to SVG successfully: ${validatedOutputPath}` } as TextContent]
                };
                } else {
                    throw new Error("SVGMaker API did not return SVG content.");
                }
            } finally {
                // Clean up the interval
                clearInterval(progressInterval);
            }
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error converting image to SVG: ${error.message}` } as TextContent]
            };
        }
    });
}
