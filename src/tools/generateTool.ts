import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';
import { ProgressManager } from '../utils/progressUtils.js';

const GenerateToolInputSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty.')
    .describe(
      'A detailed text description of the SVG image to generate. Include style, colors, composition, and key visual elements for best results.'
    ),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .describe(
      'Absolute file path where the generated SVG will be saved. Must include the .svg extension. Example: "/Users/username/Documents/artwork.svg"'
    ),
  quality: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .default('medium')
    .describe(
      'Quality level for SVG generation. Affects processing time and detail level: low (fast, basic), medium (balanced, default, preferred if not specified explicitly by the user), high (best quality, forces square aspect ratio)'
    ),
  aspectRatio: z
    .enum(['square', 'portrait', 'landscape'])
    .optional()
    .describe(
      'Aspect ratio for the generated SVG: square (1:1, good for logos), portrait (taller, good for posters), landscape (wider, good for banners). If not specified by the user, no need to specify, as the quality will determine the default (low and medium use auto, high forces square aspect ratio)'
    ),
  background: z
    .enum(['auto', 'transparent', 'opaque'])
    .optional()
    .default('auto')
    .describe(
      'Background style: auto (AI determines best, default, preferred if not specified explicitly by the user), transparent (no background, good for overlays), opaque (solid background color)'
    ),
});

export const generateToolDefinition = {
  name: 'svgmaker_generate',
  description:
    'Generates an SVG image from a detailed text prompt using SVGMaker API and saves it to a specified local path. For best results, provide a clear, detailed description of the desired image including style, colors, composition, and key elements. If quality is not specified, medium quality will be used by default.',
  inputSchema: zodToJsonSchema(GenerateToolInputSchema),
};

export async function handleGenerateTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  const { arguments: args } = request.params;

  // Log that the tool is being called
  logToFile('========== SVG GENERATE TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(args, null, 2)}`);
  logToFile(`Request meta: ${JSON.stringify(request.params._meta, null, 2)}`);

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

    const progressManager = new ProgressManager({
      server,
      progressToken: request.params._meta?.progressToken,
      totalSteps: 4,
      messages: {
        initial: 'Initializing SVG generation...',
        preparing: 'Preparing API request...',
        processing: 'AI is creating your SVG...',
        saving: 'Saving SVG file...',
        complete: 'SVG generation complete!',
      },
    });

    // Send initial progress
    await progressManager.sendInitialProgress();

    try {
      const sdkParams = {
        prompt: validatedArgs.prompt,
        quality: validatedArgs.quality,
        aspectRatio: finalAspectRatio,
        background: validatedArgs.background,
        svgText: true,
      };

      // Update progress: preparing request
      await progressManager.sendPreparingProgress();

      // Update progress: making API call with periodic updates
      await progressManager.startProcessingProgress();

      let result;
      try {
        // The actual API call
        result = await svgmakerService.generateSVG(sdkParams as any);
      } finally {
        // Clean up the progress interval
        progressManager.stopProcessingProgress();
      }

      // Update progress: processing complete
      await progressManager.sendSavingProgress();

      if (result.svgText) {
        await fileUtils.writeFile(validatedOutputPath, result.svgText);

        // Send final progress
        await progressManager.sendFinalProgress();

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
    } catch (error: any) {
      // Ensure cleanup on error
      progressManager.cleanup();
      throw error;
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error generating SVG: ${error.message}` } as TextContent],
    };
  }
}
