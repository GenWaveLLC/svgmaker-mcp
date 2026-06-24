import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';
import { ProgressManager } from '../utils/progressUtils.js';
import { buildUrlResult } from '../utils/outputUtils.js';

const ConvertToolInputSchema = z.object({
  input_path: z
    .string()
    .min(1, 'Input path cannot be empty.')
    .describe(
      'Absolute path to the existing image file to be converted to SVG format. Supports various bitmap formats including PNG, JPEG, GIF, BMP, TIFF, and WebP. Example: "/Users/username/Pictures/photo.jpg"'
    ),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .optional()
    .describe(
      'Optional absolute file path where the generated SVG will be saved. When provided, the tool saves the SVG locally (must include the .svg extension). When omitted, the tool returns a SVGMaker-hosted URL instead of writing to disk (cloud mode). Example: "/Users/username/Documents/vector-art.svg"'
    ),
});

export const convertToolDefinition = {
  name: 'svgmaker_convert',
  description:
    'Converts a raster image (PNG, JPEG, WebP, etc.) to SVG format using AI-powered vectorization via SVGMaker API. The AI analyzes the image and recreates it as clean, scalable vector graphics. Saves the result to a specified local path.',
  inputSchema: zodToJsonSchema(ConvertToolInputSchema),
};

export async function handleConvertTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient
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
    const validatedOutputPath = validatedArgs.output_path
      ? await fileUtils.resolveAndValidatePath(validatedArgs.output_path, clientRoots, 'write')
      : undefined;

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
        result = await svgmakerService.convertImageToSVG(sdkParams as any, client);
      } finally {
        // Clean up the progress interval
        progressManager.stopProcessingProgress();
      }

      // Update progress: processing complete
      await progressManager.sendSavingProgress();

      if (validatedOutputPath) {
        // Local/stdio mode: save SVG to disk.
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
      } else {
        // Cloud mode: return the SVGMaker-hosted URL, no disk writes.
        if (!result.svgUrl) {
          throw new Error('SVGMaker API did not return a hosted URL.');
        }

        // Send final progress
        await progressManager.sendFinalProgress();

        return buildUrlResult(
          'Image converted to SVG successfully.',
          result.svgUrl,
          result.svgUrlExpiresIn
        );
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
