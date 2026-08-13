import fs from 'fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, ImageContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import { DEFAULT_TOOL_CONTEXT, type ToolContext } from '../types/toolContext.js';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';
import { fetchRemotePreview } from '../utils/previewUtils.js';
import { buildUrlResult, rejectOutputPathOverHttp } from '../utils/outputUtils.js';

// ── Gallery List Tool ──

const GalleryListToolInputSchema = z.object({
  page: z.number().int().positive().optional().describe('Page number, 1-indexed. Defaults to 1.'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page, 1 to 100.'),
  type: z
    .string()
    .optional()
    .describe('Keep only this generation type: "generate", "edit", "convert".'),
  hashtags: z.array(z.string()).optional().describe('Keep only items carrying all these hashtags.'),
  categories: z.array(z.string()).optional().describe('Keep only items in these categories.'),
  query: z.string().optional().describe('Free-text search over the prompt and description.'),
  pro: z.string().optional().describe('Pass the string "true" to keep only pro images.'),
  gold: z.string().optional().describe('Pass the string "true" to keep only gold images.'),
});

export function buildGalleryListToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_gallery_list',
    description:
      'Browse the public SVGMaker gallery and list item ids, with optional filters and pagination. Use this to find reference or inspiration images made by other users. For images the caller made themselves, use svgmaker_generations_list instead. Returns ids and page counts only, not images.',
    inputSchema: zodToJsonSchema(GalleryListToolInputSchema),
  };
}

export async function handleGalleryListTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GALLERY LIST TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GalleryListToolInputSchema.parse(request.params.arguments);

    // Build params with only defined fields
    const params: Record<string, any> = {};
    if (validatedArgs.page !== undefined) params.page = validatedArgs.page;
    if (validatedArgs.limit !== undefined) params.limit = validatedArgs.limit;
    if (validatedArgs.type !== undefined) params.type = validatedArgs.type;
    if (validatedArgs.hashtags !== undefined) params.hashtags = validatedArgs.hashtags;
    if (validatedArgs.categories !== undefined) params.categories = validatedArgs.categories;
    if (validatedArgs.query !== undefined) params.query = validatedArgs.query;
    if (validatedArgs.pro !== undefined) params.pro = validatedArgs.pro;
    if (validatedArgs.gold !== undefined) params.gold = validatedArgs.gold;

    const result = await svgmakerService.listGallery(
      Object.keys(params).length > 0 ? params : undefined,
      client
    );

    const lines: string[] = [];
    const p = result.pagination;
    lines.push(`Gallery (Page ${p.page} of ${p.totalPages}, Total: ${p.totalItems}):`);
    if (result.items && result.items.length > 0) {
      for (const id of result.items) {
        lines.push(`- ${id}`);
      }
    }
    lines.push('');
    lines.push(`Has Next Page: ${p.hasNextPage}`);

    const text = lines.join('\n');

    return {
      content: [{ type: 'text', text } as TextContent],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error listing gallery: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Gallery Get Tool ──

const GalleryGetToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of a public gallery item, as returned by svgmaker_gallery_list.'),
});

export function buildGalleryGetToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_gallery_get',
    description:
      'Get the details of a public gallery item by id: the prompt used, type, quality, hashtags and categories. Returns metadata as text, not the image — use svgmaker_gallery_preview to see the image itself.',
    inputSchema: zodToJsonSchema(GalleryGetToolInputSchema),
  };
}

export async function handleGalleryGetTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GALLERY GET TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GalleryGetToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.getGalleryItem(validatedArgs.generation_id, client);

    const hashTags =
      result.hashTags && result.hashTags.length > 0 ? result.hashTags.join(', ') : 'None';
    const categories =
      result.categories && result.categories.length > 0 ? result.categories.join(', ') : 'None';

    const text = [
      'Gallery Item Details:',
      `- ID: ${result.id}`,
      `- Prompt: ${result.prompt}`,
      `- Type: ${result.type}`,
      `- Quality: ${result.quality}`,
      `- Public: ${result.isPublic}`,
      `- Hashtags: ${hashTags}`,
      `- Categories: ${categories}`,
    ].join('\n');

    return {
      content: [{ type: 'text', text } as TextContent],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error getting gallery item: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Gallery Download Tool ──

const GalleryDownloadToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of a public gallery item, as returned by svgmaker_gallery_list.'),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .optional()
    .describe(
      'Absolute file path to save the download to, e.g. "/Users/me/Desktop/icon.svg". Give it the extension that matches format. Omit it to get an SVGMaker-hosted download URL instead of a file. Stdio transport only.'
    ),
  format: z
    .enum(['svg', 'webp', 'png', 'svg-optimized', 'svgz'])
    .optional()
    .describe(
      'Output format: svg (source vector), svg-optimized (smaller vector), svgz (gzipped vector), png or webp (raster). Defaults to webp. The three vector formats cost 1 credit each; png and webp are free.'
    ),
  optimize: z
    .boolean()
    .optional()
    .describe('Optimize the vector before gzip compression. Applies to the svgz format only.'),
});

export function buildGalleryDownloadToolDefinition(ctx: ToolContext) {
  const isHttp = ctx.transport === 'http';
  return {
    name: 'svgmaker_gallery_download',
    description: isHttp
      ? 'Download a public gallery item in a chosen format and get back a time-limited SVGMaker-hosted URL for the file. Formats: svg, svg-optimized, svgz, png, webp. The vector formats cost 1 credit each, png and webp are free. Give the returned URL to the user, or fetch it yourself; the download cannot be written anywhere for you. Use svgmaker_gallery_preview instead when you only need to look at the image.'
      : 'Download a public gallery item in a chosen format. Saves the file to output_path when you pass one, otherwise returns a time-limited SVGMaker-hosted download URL. Formats: svg, svg-optimized, svgz, png, webp. The vector formats cost 1 credit each, png and webp are free. Use svgmaker_gallery_preview instead when you only need to look at the image.',
    // The runtime schema keeps output_path so the guard can answer a stale client.
    inputSchema: zodToJsonSchema(
      isHttp
        ? GalleryDownloadToolInputSchema.omit({ output_path: true })
        : GalleryDownloadToolInputSchema
    ),
  };
}

export async function handleGalleryDownloadTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GALLERY DOWNLOAD TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GalleryDownloadToolInputSchema.parse(request.params.arguments);

    const outputPathRejection = rejectOutputPathOverHttp(validatedArgs.output_path, ctx);
    if (outputPathRejection) return outputPathRejection;

    const validatedOutputPath = validatedArgs.output_path
      ? await fileUtils.resolveAndValidatePath(validatedArgs.output_path, 'write')
      : undefined;

    // Build SDK params with only defined fields
    const params: Record<string, any> = {};
    if (validatedArgs.format !== undefined) params.format = validatedArgs.format;
    if (validatedArgs.optimize !== undefined) params.optimize = validatedArgs.optimize;

    const result = await svgmakerService.downloadGalleryItem(
      validatedArgs.generation_id,
      Object.keys(params).length > 0 ? params : undefined,
      client
    );

    if (!validatedOutputPath) {
      // Cloud mode: return the SVGMaker-hosted download URL, no disk writes.
      if (!result.url) {
        throw new Error('SVGMaker API did not return a hosted URL.');
      }
      return buildUrlResult('Gallery item download ready.', result.url, result.urlExpiresIn);
    }

    // Local/stdio mode: fetch the file from the download URL and save it.
    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(`Failed to download file: HTTP ${response.status}`);
    }

    // Determine if text or binary based on format
    const isTextFormat = validatedArgs.format === 'svg' || validatedArgs.format === 'svg-optimized';

    if (isTextFormat) {
      await fileUtils.writeFile(validatedOutputPath, await response.text());
    } else {
      await fs.writeFile(validatedOutputPath, Buffer.from(await response.arrayBuffer()));
    }

    return {
      content: [
        {
          type: 'text',
          text: `File downloaded successfully: ${validatedOutputPath} (format: ${result.format})\nNote: SVG formats cost 1 credit per download. WebP/PNG are free.`,
        } as TextContent,
      ],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error downloading gallery item: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Gallery Preview Tool ──

const GalleryPreviewToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of a public gallery item, as returned by svgmaker_gallery_list.'),
});

export function buildGalleryPreviewToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_gallery_preview',
    description:
      'Show a public gallery item in the conversation as a PNG image. Use this to check what a gallery item looks like, on any transport, and it costs no credits. Use svgmaker_gallery_download instead when the user wants the file or a URL, and svgmaker_generations_preview for generations the caller made.',
    inputSchema: zodToJsonSchema(GalleryPreviewToolInputSchema),
  };
}

export async function handleGalleryPreviewTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GALLERY PREVIEW TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GalleryPreviewToolInputSchema.parse(request.params.arguments);

    const result = await svgmakerService.downloadGalleryItem(
      validatedArgs.generation_id,
      {
        format: 'png',
      },
      client
    );
    const base64Data = await fetchRemotePreview(result.url);

    return {
      content: [
        {
          type: 'image',
          data: base64Data,
          mimeType: 'image/png',
        } as ImageContent,
      ],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error previewing gallery item: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
