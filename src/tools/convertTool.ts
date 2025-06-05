import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';
import { ProgressManager } from '../utils/progressUtils.js';

const ConvertToolInputSchema = z.object({
  input_path: z
    .string()
    .min(1, 'Input path cannot be empty. Must be an absolute path to the image file.'),
  output_path: z.string().min(1, 'Output path cannot be empty.'),
});

export const convertToolDefinition = {
  name: 'svgmaker_convert',
  description:
    'Converts an image file to SVG format using SVGMaker API and saves it to a specified local path. Supports various image formats including PNG, JPEG, and other common bitmap formats. The resulting SVG will be a vector representation of the original image, optimized for scalability and compatibility with vector graphics tools.',
  inputSchema: zodToJsonSchema(ConvertToolInputSchema),
};

export async function handleConvertTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  const { arguments: args } = request.params;

  // Log that the tool is being called
  logToFile('========== SVG CONVERT TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(args, null, 2)}`);
  logToFile(`Request meta: ${JSON.stringify(request.params._meta, null, 2)}`);

  try {
    const validatedArgs = ConvertToolInputSchema.parse(args);

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

    const progressManager = new ProgressManager({
      server,
      progressToken: request.params._meta?.progressToken,
      totalSteps: 4,
      messages: {
        initial: 'Initializing image conversion...',
        preparing: 'Preparing image for conversion...',
        processing: 'Converting image to SVG...',
        saving: 'Saving SVG file...',
        complete: 'Image conversion complete!',
      },
    });

    // Send initial progress
    await progressManager.sendInitialProgress();

    try {
      const sdkParams = {
        file: inputImage,
        svgText: true,
      };

      // Update progress: preparing request
      await progressManager.sendPreparingProgress();

      // Update progress: making API call with periodic updates
      await progressManager.startProcessingProgress();

      let result;
      try {
        // The actual API call
        result = await svgmakerService.convertImageToSVG(sdkParams as any);
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
              text: `Image converted to SVG successfully: ${validatedOutputPath}`,
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
      content: [
        {
          type: 'text',
          text: `Error converting image to SVG: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
