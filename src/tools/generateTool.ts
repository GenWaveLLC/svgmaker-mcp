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

const GenerateToolInputSchema = z
  .object({
    prompt: z
      .string()
      .min(1, 'Prompt cannot be empty.')
      .describe(
        'A detailed text description of the SVG image to generate. Include style, colors, composition, and key visual elements for best results.'
      ),
    output_path: z
      .string()
      .min(1, 'Output path cannot be empty.')
      .optional()
      .describe(
        'Optional. Absolute file path where the generated SVG will be saved locally. Must include the .svg extension. Example: "/Users/username/Documents/artwork.svg". When provided, the file is saved to disk. When omitted (cloud mode), the tool returns a hosted SVGMaker URL instead of saving a file.'
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
    style: z
      .enum([
        'flat',
        'line_art',
        'engraving',
        'linocut',
        'silhouette',
        'isometric',
        'cartoon',
        'ghibli',
      ])
      .optional()
      .describe(
        'Art style for the SVG: flat (clean minimal), line_art (outline-based), engraving (detailed etched), linocut (block print), silhouette (solid shapes), isometric (3D-like), cartoon (playful), ghibli (anime-inspired). Only specify if user requests a specific style.'
      ),
    color_mode: z
      .enum(['full_color', 'monochrome', 'few_colors'])
      .optional()
      .describe(
        'Color scheme: full_color (default, wide palette), monochrome (single color/shades), few_colors (limited palette). Only specify if user requests a specific color scheme.'
      ),
    image_complexity: z
      .enum(['icon', 'illustration', 'scene'])
      .optional()
      .describe(
        'Complexity level: icon (simple, minimal detail), illustration (moderate detail), scene (complex, full composition). Only specify if user requests a specific complexity.'
      ),
    composition: z
      .enum(['centered_object', 'repeating_pattern', 'full_scene', 'objects_in_grid'])
      .optional()
      .describe(
        'Layout composition: centered_object (single focus element), repeating_pattern (tiled/repeated), full_scene (complete scene), objects_in_grid (grid arrangement). Only specify if user requests a specific layout.'
      ),
    text_style: z
      .enum(['only_title', 'embedded_text'])
      .optional()
      .describe(
        'Text handling in SVG: only_title (just a title/heading), embedded_text (text integrated into the design). Only specify if the design should include text.'
      ),
    raster: z
      .boolean()
      .optional()
      .describe(
        'When true, skips SVG vectorization and returns a raster PNG image instead of SVG. The output_path should use .png extension. Useful when the user wants a quick raster image without vectorization. Cannot be used with storage.'
      ),
    storage: z
      .boolean()
      .optional()
      .describe(
        'When true, stores the generated image permanently in cloud storage. Cannot be used with raster mode. Defaults to true when raster is not set.'
      ),
  })
  .refine((data) => !(data.raster && data.storage), {
    message:
      "Cannot use 'storage: true' with 'raster: true'. Raster mode returns temporary URLs only.",
  });

export const generateToolDefinition = {
  name: 'svgmaker_generate',
  description:
    'Generates an SVG image from a detailed text prompt using SVGMaker API and saves it to a specified local path. For best results, provide a clear, detailed description of the desired image including style, colors, composition, and key elements. If quality is not specified, medium quality will be used by default.',
  inputSchema: zodToJsonSchema(GenerateToolInputSchema),
};

export async function handleGenerateTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  const { arguments: args } = request.params;

  // Log that the tool is being called
  logToFile('========== SVG GENERATE TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(args, null, 2)}`);
  logToFile(`Request meta: ${JSON.stringify(request.params._meta, null, 2)}`);

  try {
    const validatedArgs = GenerateToolInputSchema.parse(args);

    const outputPathRejection = rejectOutputPathOverHttp(validatedArgs.output_path, ctx);
    if (outputPathRejection) return outputPathRejection;

    let validatedOutputPath: string | undefined;
    if (validatedArgs.output_path) {
      validatedOutputPath = await fileUtils.resolveAndValidatePath(
        validatedArgs.output_path,
        'write'
      );
    }

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
      // Build styleParams from individual style fields
      const styleParams: Record<string, string> = {};
      if (validatedArgs.style) styleParams.style = validatedArgs.style;
      if (validatedArgs.color_mode) styleParams.color_mode = validatedArgs.color_mode;
      if (validatedArgs.image_complexity)
        styleParams.image_complexity = validatedArgs.image_complexity;
      if (validatedArgs.composition) styleParams.composition = validatedArgs.composition;
      if (validatedArgs.text_style) styleParams.text = validatedArgs.text_style;

      const sdkParams: Record<string, any> = {
        prompt: validatedArgs.prompt,
        quality: validatedArgs.quality,
        aspectRatio: finalAspectRatio,
        background: validatedArgs.background,
        svgText: !validatedArgs.raster,
      };

      if (validatedArgs.raster) {
        sdkParams.raster = true;
      }

      if (validatedArgs.storage !== undefined) {
        sdkParams.storage = validatedArgs.storage;
      }

      if (Object.keys(styleParams).length > 0) {
        sdkParams.styleParams = styleParams;
      }

      // Update progress: preparing request
      await progressManager.sendPreparingProgress();

      // Update progress: making API call with periodic updates
      await progressManager.startProcessingProgress();

      let result;
      try {
        // The actual API call
        result = await svgmakerService.generateSVG(sdkParams as any, client);
      } finally {
        // Clean up the progress interval
        progressManager.stopProcessingProgress();
      }

      // Update progress: processing complete
      await progressManager.sendSavingProgress();

      if (validatedOutputPath) {
        // Local/stdio mode: save the output to disk.
        if (validatedArgs.raster && result.imageUrl) {
          const response = await fetch(result.imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to download raster image: HTTP ${response.status}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          await fileUtils.writeFileBuffer(validatedOutputPath, buffer);

          await progressManager.sendFinalProgress();

          return {
            content: [
              {
                type: 'text',
                text: `Raster PNG generated successfully: ${validatedOutputPath}`,
              } as TextContent,
            ],
          };
        } else if (result.svgText) {
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
      } else {
        // Cloud mode: no output path provided, return the hosted URL.
        await progressManager.sendFinalProgress();

        if (validatedArgs.raster && result.imageUrl) {
          return buildUrlResult(
            'Raster PNG generated successfully.',
            result.imageUrl,
            result.imageUrlExpiresIn
          );
        } else if (result.svgUrl) {
          return buildUrlResult(
            'SVG generated successfully.',
            result.svgUrl,
            result.svgUrlExpiresIn
          );
        } else {
          throw new Error('SVGMaker API did not return a hosted URL.');
        }
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
