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
    .min(1, 'Input path cannot be empty. Must be an absolute path to the image file.'),
  prompt: z.string().min(1, 'Prompt cannot be empty.'),
  output_path: z.string().min(1, 'Output path cannot be empty.'),
  quality: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe("Quality level - affects aspect ratio: low/medium use 'auto', high uses 'square'"),
  aspectRatio: z
    .enum(['auto', 'portrait', 'landscape', 'square'])
    .optional()
    .describe('Aspect ratio for the edited SVG'),
  background: z.enum(['auto', 'transparent', 'opaque']).optional().describe('Background type'),
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
