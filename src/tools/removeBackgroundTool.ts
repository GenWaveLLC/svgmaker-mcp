import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import { DEFAULT_TOOL_CONTEXT, type ToolContext } from '../types/toolContext.js';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';
import { ProgressManager } from '../utils/progressUtils.js';
import { buildUrlResult, rejectOutputPathOverHttp } from '../utils/outputUtils.js';
import {
  applyImageInput,
  INPUT_PARAM_DESCRIPTION,
  resolveImageInput,
  selectImageSource,
} from '../utils/inputResolver.js';

const RemoveBackgroundToolInputSchema = z.object({
  input: z.string().min(1, 'Input cannot be empty.').optional().describe(INPUT_PARAM_DESCRIPTION),
  input_path: z
    .string()
    .min(1, 'Input path cannot be empty.')
    .optional()
    .describe(
      'Deprecated alias for `input`, restricted to a local absolute file path. Prefer `input`.'
    ),
  generation_id: z
    .string()
    .min(1, 'Generation ID cannot be empty.')
    .optional()
    .describe(
      'Deprecated alias for `input`, restricted to an SVGMaker generation or gallery id. Prefer `input`.'
    ),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .optional()
    .describe(
      'Optional absolute file path where the background-removed SVG will be saved (must include the .svg extension). When provided, the tool saves the SVG locally. When omitted, the tool returns a SVGMaker-hosted URL instead of writing to disk (cloud mode). Example: "/Users/username/Documents/cutout.svg"'
    ),
  storage: z
    .boolean()
    .optional()
    .describe(
      'When true, stores the resulting SVG permanently in cloud storage (it appears in your SVGMaker generations). When false, a temporary hosted URL is returned. Defaults to true.'
    ),
});

export const removeBackgroundToolDefinition = {
  name: 'svgmaker_remove_background',
  description:
    'Removes the background from an image and returns the result as a clean SVG with transparency, using the SVGMaker API. The AI isolates the foreground subject, removes the background, and vectorizes the result. The image comes from `input`, which accepts a local file path (stdio only), an https:// URL, an upl_ upload id, or a generation id. Saves the SVG to output_path when given, otherwise returns a hosted URL.',
  inputSchema: zodToJsonSchema(RemoveBackgroundToolInputSchema),
};

export async function handleRemoveBackgroundTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  const { arguments: args } = request.params;

  // Log that the tool is being called
  logToFile('========== SVG REMOVE BACKGROUND TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(args, null, 2)}`);
  logToFile(`Request meta: ${JSON.stringify(request.params._meta, null, 2)}`);

  try {
    const validatedArgs = RemoveBackgroundToolInputSchema.parse(args);

    const outputPathRejection = rejectOutputPathOverHttp(validatedArgs.output_path, ctx);
    if (outputPathRejection) return outputPathRejection;

    const imageSource = selectImageSource(validatedArgs);

    const validatedOutputPath = validatedArgs.output_path
      ? await fileUtils.resolveAndValidatePath(validatedArgs.output_path, 'write')
      : undefined;

    const resolvedInput = await resolveImageInput(imageSource, ctx);

    const progressManager = new ProgressManager({
      server,
      progressToken: request.params._meta?.progressToken,
      totalSteps: 4,
      messages: {
        initial: 'Initializing background removal...',
        preparing: 'Preparing image for background removal...',
        processing: 'Removing background and vectorizing...',
        saving: 'Saving SVG file...',
        complete: 'Background removal complete!',
      },
    });

    // Send initial progress
    await progressManager.sendInitialProgress();

    try {
      const sdkParams: Record<string, any> = {
        svgText: true,
      };

      applyImageInput(sdkParams, resolvedInput, 'file');

      if (validatedArgs.storage !== undefined) {
        sdkParams.storage = validatedArgs.storage;
      }

      // Update progress: preparing request
      await progressManager.sendPreparingProgress();

      // Update progress: making API call with periodic updates
      await progressManager.startProcessingProgress();

      let result;
      try {
        // The actual API call
        result = await svgmakerService.removeBackground(sdkParams as any, client);
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
                text: `Background removed successfully: ${validatedOutputPath}`,
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
          'Background removed successfully.',
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
          text: `Error removing background: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
