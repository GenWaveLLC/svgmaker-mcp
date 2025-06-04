import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent,
  RequestMeta,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';

const GenerateToolInputSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty.'),
  output_path: z.string().min(1, 'Output path cannot be empty.'),
  quality: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe("Quality level - affects aspect ratio: low/medium use 'auto', high uses 'square'"),
  aspectRatio: z
    .enum(['square', 'portrait', 'landscape'])
    .optional()
    .describe('Aspect ratio for the generated SVG'),
  background: z.enum(['auto', 'transparent', 'opaque']).optional().describe('Background type'),
});

export function registerGenerateTool(server: Server) {
  // Register the list tools handler if not already registered
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'svgmaker_generate',
          description:
            'Generates an SVG image from a text prompt using SVGMaker API and saves it to a specified local path.',
          inputSchema: zodToJsonSchema(GenerateToolInputSchema),
        },
      ],
    };
  });

  // Register the call tool handler if not already registered
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }) => {
      const { name, arguments: args } = request.params;

      if (name !== 'svgmaker_generate') {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const validatedArgs = GenerateToolInputSchema.parse(args);

        // Note: In a real implementation, we'd need to get roots from the client
        // For now, we'll use a simple path validation
        const clientRoots: any[] = []; // server.getRoots() is not available in this SDK version
        const validatedOutputPath = await fileUtils.resolveAndValidatePath(
          validatedArgs.output_path,
          clientRoots,
          'write'
        );

        // Determine aspect ratio based on quality and explicit aspectRatio
        let finalAspectRatio = validatedArgs.aspectRatio;
        if (!finalAspectRatio) {
          if (validatedArgs.quality === 'high') {
            finalAspectRatio = 'square';
          } else {
            finalAspectRatio = 'auto' as any; // low and medium use auto
          }
        }

        // Send initial progress
        if (request.params._meta?.progressToken) {
          (server as any).sendProgress(request.params._meta.progressToken, {
            content: [{ type: 'text', text: 'Starting SVG generation...' }],
            percentage: 0,
          });
        }

        // Start progress updates every 5 seconds
        let currentProgress = 0;
        const progressInterval = setInterval(() => {
          if (request.params._meta?.progressToken && currentProgress < 95) {
            currentProgress += 25;
            (server as any).sendProgress(request.params._meta.progressToken, {
              content: [{ type: 'text', text: `Generating SVG... ${currentProgress}%` }],
              percentage: currentProgress,
            });
          }
        }, 5000);

        try {
          const sdkParams = {
            prompt: validatedArgs.prompt,
            quality: validatedArgs.quality,
            aspectRatio: finalAspectRatio,
            svgText: true,
          };

          // The actual API call remains non-streaming
          const result = await svgmakerService.generateSVG(sdkParams as any);

          // Send completion progress
          if (request.params._meta?.progressToken) {
            (server as any).sendProgress(request.params._meta.progressToken, {
              content: [{ type: 'text', text: 'SVG generation complete!' }],
              percentage: 100,
            });
          }

          if (result.svgText) {
            await fileUtils.writeFile(validatedOutputPath, result.svgText);
            return {
              content: [
                {
                  type: 'text',
                  text: `SVG generated successfully: ${validatedOutputPath}`,
                } as TextContent,
              ],
            };
          } else {
            throw new Error('SVGMaker API did not return SVG content.');
          }
        } finally {
          // Clean up the interval
          clearInterval(progressInterval);
        }
      } catch (error: any) {
        return {
          isError: true,
          content: [
            { type: 'text', text: `Error generating SVG: ${error.message}` } as TextContent,
          ],
        };
      }
    }
  );
}
