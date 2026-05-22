import fs from 'fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, ImageContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';
import { fetchRemotePreview } from '../utils/previewUtils.js';

// ── Gallery List Tool ──

const GalleryListToolInputSchema = z.object({
  page: z.number().int().positive().optional().describe('Page number (1-indexed)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (1-100)'),
  type: z
    .string()
    .optional()
    .describe('Filter by generation type (e.g., "generate", "edit", "convert")'),
  hashtags: z.array(z.string()).optional().describe('Filter by hashtags'),
  categories: z.array(z.string()).optional().describe('Filter by categories'),
  query: z.string().optional().describe('Search query for prompt/description'),
  pro: z.string().optional().describe('Filter for pro images. Pass "true" to filter.'),
  gold: z.string().optional().describe('Filter for gold images. Pass "true" to filter.'),
});

export const galleryListToolDefinition = {
  name: 'svgmaker_gallery_list',
  description:
    'Browse the public SVGMaker gallery with optional filtering and pagination. Returns gallery item IDs that can be used with other gallery tools.',
  inputSchema: zodToJsonSchema(GalleryListToolInputSchema),
};

export async function handleGalleryListTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
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
      Object.keys(params).length > 0 ? params : undefined
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
  generation_id: z.string().min(1, 'Generation ID is required'),
});

export const galleryGetToolDefinition = {
  name: 'svgmaker_gallery_get',
  description:
    'Gets detailed information about a specific gallery item by ID, including the prompt used, type, quality level, hashtags, and categories.',
  inputSchema: zodToJsonSchema(GalleryGetToolInputSchema),
};

export async function handleGalleryGetTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GALLERY GET TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GalleryGetToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.getGalleryItem(validatedArgs.generation_id);

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
  generation_id: z.string().min(1, 'Generation ID is required'),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .describe('Absolute file path where the downloaded file will be saved.'),
  format: z
    .enum(['svg', 'webp', 'png', 'svg-optimized', 'svgz'])
    .optional()
    .describe('Download format. Defaults to webp.'),
  optimize: z.boolean().optional().describe('Optimize before compressing (only for svgz format).'),
});

export const galleryDownloadToolDefinition = {
  name: 'svgmaker_gallery_download',
  description:
    'Downloads a gallery item in the specified format and saves it to a local file. Supports SVG, WebP, PNG, optimized SVG, and SVGZ formats. Costs 1 credit for SVG formats (svg, svg-optimized, svgz), 0 credits for WebP/PNG.',
  inputSchema: zodToJsonSchema(GalleryDownloadToolInputSchema),
};

export async function handleGalleryDownloadTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GALLERY DOWNLOAD TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GalleryDownloadToolInputSchema.parse(request.params.arguments);

    const validatedOutputPath = await fileUtils.resolveAndValidatePath(
      validatedArgs.output_path,
      [],
      'write'
    );

    // Build SDK params with only defined fields
    const params: Record<string, any> = {};
    if (validatedArgs.format !== undefined) params.format = validatedArgs.format;
    if (validatedArgs.optimize !== undefined) params.optimize = validatedArgs.optimize;

    const result = await svgmakerService.downloadGalleryItem(
      validatedArgs.generation_id,
      Object.keys(params).length > 0 ? params : undefined
    );

    // Fetch the file from the download URL
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
  generation_id: z.string().min(1, 'Generation ID is required'),
});

export const galleryPreviewToolDefinition = {
  name: 'svgmaker_gallery_preview',
  description:
    'Previews a gallery item by returning the image directly in the chat context as a PNG image. Use this to visually inspect a gallery item without saving it to disk.',
  inputSchema: zodToJsonSchema(GalleryPreviewToolInputSchema),
};

export async function handleGalleryPreviewTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GALLERY PREVIEW TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GalleryPreviewToolInputSchema.parse(request.params.arguments);

    const result = await svgmakerService.downloadGalleryItem(validatedArgs.generation_id, {
      format: 'png',
    });
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
