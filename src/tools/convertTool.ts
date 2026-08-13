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
  NO_GENERATION_INPUT_PARAM_DESCRIPTION,
  NO_GENERATION_INPUT_PARAM_DESCRIPTION_HTTP,
  resolveImageInput,
  selectImageSource,
} from '../utils/inputResolver.js';

const ConvertToolInputSchema = z.object({
  input: z
    .string()
    .min(1, 'Input cannot be empty.')
    .optional()
    .describe(NO_GENERATION_INPUT_PARAM_DESCRIPTION),
  input_path: z
    .string()
    .min(1, 'Input path cannot be empty.')
    .optional()
    .describe(
      'Deprecated alias for `input`, restricted to a local absolute file path. Prefer `input`.'
    ),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .optional()
    .describe(
      'Optional absolute file path to save the SVG locally. Must include the .svg extension. Example: "/Users/username/Documents/vector-art.svg". Omit it to get a hosted SVGMaker URL instead of a file.'
    ),
});

// input_path is local-path-only, so over HTTP it is dropped alongside output_path.
const ConvertToolHttpSchema = ConvertToolInputSchema.omit({
  output_path: true,
  input_path: true,
}).extend({
  input: z
    .string()
    .min(1, 'Input cannot be empty.')
    .optional()
    .describe(NO_GENERATION_INPUT_PARAM_DESCRIPTION_HTTP),
});

const CONVERT_DESCRIPTION_STDIO =
  'Convert a raster image (PNG, JPEG, WebP) to SVG by AI vectorization. Use this to trace an existing image as-is; use svgmaker_edit when the image should also be changed. The image comes from `input`, which accepts a local absolute file path, an https:// URL, or an upl_ upload id. Generation ids are not accepted — a generation is already an SVG. Returns the saved file path when output_path is given, otherwise a hosted SVGMaker URL.';

const CONVERT_DESCRIPTION_HTTP =
  'Convert a raster image (PNG, JPEG, WebP) to SVG by AI vectorization. Use this to trace an existing image as-is; use svgmaker_edit when the image should also be changed. The image comes from `input`, which accepts an https:// URL or an upl_ upload id from svgmaker_upload. Generation ids are not accepted — a generation is already an SVG. Returns a hosted SVGMaker URL for the vectorized file, plus its expiry. To save it locally, download that URL yourself before it expires.';

export function buildConvertToolDefinition(ctx: ToolContext) {
  const isHttp = ctx.transport === 'http';
  return {
    name: 'svgmaker_convert',
    description: isHttp ? CONVERT_DESCRIPTION_HTTP : CONVERT_DESCRIPTION_STDIO,
    inputSchema: zodToJsonSchema(isHttp ? ConvertToolHttpSchema : ConvertToolInputSchema),
  };
}

export async function handleConvertTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  const { arguments: args } = request.params;

  // Log that the tool is being called
  logToFile('========== SVG CONVERT TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(args, null, 2)}`);
  logToFile(`Request meta: ${JSON.stringify(request.params._meta, null, 2)}`);

  try {
    const validatedArgs = ConvertToolInputSchema.parse(args);

    const outputPathRejection = rejectOutputPathOverHttp(validatedArgs.output_path, ctx);
    if (outputPathRejection) return outputPathRejection;

    const imageSource = selectImageSource(validatedArgs);

    const validatedOutputPath = validatedArgs.output_path
      ? await fileUtils.resolveAndValidatePath(validatedArgs.output_path, 'write')
      : undefined;

    const resolvedInput = await resolveImageInput(imageSource, ctx, { allowGenerationId: false });

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
      const sdkParams: Record<string, any> = {
        svgText: true,
      };

      applyImageInput(sdkParams, resolvedInput, 'file');

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
