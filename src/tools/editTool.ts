import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';
import { ProgressManager } from '../utils/progressUtils.js';

const EditToolInputSchema = z.object({
  input_path: z
    .string()
    .min(1, 'Input path cannot be empty.')
    .describe(
      'Absolute path to the existing image/SVG file to be edited. Supports various formats including PNG, JPEG, SVG, and other common image types. Example: "/Users/username/Documents/logo.svg"'
    ),
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty.')
    .describe(
      'Detailed instructions for how to modify the image. Be specific about changes like style adjustments, color modifications, element additions/removals, or layout changes. Example: "Change the background to blue and add a white border"'
    ),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .describe(
      'Absolute file path where the generated SVG will be saved. Must include the .svg extension. Example: "/Users/username/Documents/modified-artwork.svg"'
    ),
  quality: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .default('medium')
    .describe(
      'Quality level for SVG editing. Do not specifiy if not explicitely mentioned by the user. Affects processing time and detail level: low (fast, basic edits), medium (balanced quality and speed, default), high (best quality, forces square aspect ratio)'
    ),
  aspectRatio: z
    .enum(['auto', 'portrait', 'landscape', 'square'])
    .optional()
    .describe(
      'Aspect ratio for the edited SVG: auto (maintain original proportions), square (1:1, good for logos), portrait (taller, good for posters), landscape (wider, good for banners). Do not specifiy if not explicitely mentioned by the user. When not specified the quality will determine the default (low and medium use auto, high forces square aspect ratio)'
    ),
  background: z
    .enum(['auto', 'transparent', 'opaque'])
    .optional()
    .default('auto')
    .describe(
      'Background style for the edited SVG: auto (AI determines best, default), transparent (no background, preserves transparency), opaque (solid background color). Do not specify if not explicitly mentioned by the user.'
    ),
});

export const editToolDefinition = {
  name: 'svgmaker_edit',
  description:
    'Edits an existing image/SVG file based on a text prompt using SVGMaker API and saves it to a specified local path. Provide specific instructions on how to modify the image, including style changes, color adjustments, element additions or removals, and layout modifications.',
  inputSchema: zodToJsonSchema(EditToolInputSchema),
};

export async function handleEditTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  const { arguments: args } = request.params;

  // Log that the tool is being called
  logToFile('========== SVG EDIT TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(args, null, 2)}`);
  logToFile(`Request meta: ${JSON.stringify(request.params._meta, null, 2)}`);

  try {
    const validatedArgs = EditToolInputSchema.parse(args);

    // Note: In a real implementation, we'd need to get roots from the client
    // For now, we'll use a simple path validation
    const clientRoots: any[] = []; // server.getRoots() is not available in this SDK version
    const validatedInputPath = await fileUtils.resolveAndValidatePath(
      validatedArgs.input_path,
      clientRoots,
      'read'
    );
    const validatedOutputPath = await fileUtils.resolveAndValidatePath(
      validatedArgs.output_path,
      clientRoots,
      'write'
    );

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

    const progressManager = new ProgressManager({
      server,
      progressToken: request.params._meta?.progressToken,
      totalSteps: 4,
      messages: {
        initial: 'Initializing SVG editing...',
        preparing: 'Preparing image for editing...',
        processing: 'AI is editing your SVG...',
        saving: 'Saving edited SVG file...',
        complete: 'SVG editing complete!',
      },
    });

    // Send initial progress
    await progressManager.sendInitialProgress();

    try {
      const sdkParams = {
        image: inputImage,
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
        result = await svgmakerService.editSVG(sdkParams as any);
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
              text: `SVG edited successfully: ${validatedOutputPath}`,
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
      content: [{ type: 'text', text: `Error editing SVG: ${error.message}` } as TextContent],
    };
  }
}
