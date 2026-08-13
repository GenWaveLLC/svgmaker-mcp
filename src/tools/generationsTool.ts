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

// ── Generations List Tool ──

const GenerationsListToolInputSchema = z.object({
  page: z.number().int().positive().optional().describe('Page number, 1-indexed. Defaults to 1.'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page, 1 to 100.'),
  type: z
    .string()
    .optional()
    .describe('Keep only this generation type: "generate", "edit", "convert".'),
  hashtags: z.array(z.string()).optional().describe('Keep only items carrying all these hashtags.'),
  categories: z.array(z.string()).optional().describe('Keep only items in these categories.'),
  query: z.string().optional().describe('Free-text search over the prompt and description.'),
});

export function buildGenerationsListToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_generations_list',
    description:
      'List the ids of your own SVG generations, with optional filters and pagination. Use this to find the id of earlier work before calling svgmaker_generations_get, _preview, _download, _share or _delete. For public community images, use svgmaker_gallery_list instead. Returns ids and page counts only, not images.',
    inputSchema: zodToJsonSchema(GenerationsListToolInputSchema),
  };
}

export async function handleGenerationsListTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GENERATIONS LIST TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsListToolInputSchema.parse(request.params.arguments);

    // Build params with only defined fields
    const params: Record<string, any> = {};
    if (validatedArgs.page !== undefined) params.page = validatedArgs.page;
    if (validatedArgs.limit !== undefined) params.limit = validatedArgs.limit;
    if (validatedArgs.type !== undefined) params.type = validatedArgs.type;
    if (validatedArgs.hashtags !== undefined) params.hashtags = validatedArgs.hashtags;
    if (validatedArgs.categories !== undefined) params.categories = validatedArgs.categories;
    if (validatedArgs.query !== undefined) params.query = validatedArgs.query;

    const result = await svgmakerService.listGenerations(
      Object.keys(params).length > 0 ? params : undefined,
      client
    );

    const lines: string[] = [];
    const p = result.pagination;
    lines.push(`Generations (Page ${p.page} of ${p.totalPages}, Total: ${p.totalItems}):`);
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
          text: `Error listing generations: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Generations Get Tool ──

const GenerationsGetToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of one of your generations, as returned by svgmaker_generations_list.'),
});

export function buildGenerationsGetToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_generations_get',
    description:
      'Get the details of one of your generations by id: the prompt used, type, quality, public/private state, hashtags and categories. Returns metadata as text, not the image — use svgmaker_generations_preview to see the image itself.',
    inputSchema: zodToJsonSchema(GenerationsGetToolInputSchema),
  };
}

export async function handleGenerationsGetTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GENERATIONS GET TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsGetToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.getGeneration(validatedArgs.generation_id, client);

    const hashTags =
      result.hashTags && result.hashTags.length > 0 ? result.hashTags.join(', ') : 'None';
    const categories =
      result.categories && result.categories.length > 0 ? result.categories.join(', ') : 'None';

    const text = [
      'Generation Details:',
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
          text: `Error getting generation: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Generations Delete Tool ──

const GenerationsDeleteToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of the generation to delete permanently.'),
});

export function buildGenerationsDeleteToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_generations_delete',
    description:
      'Delete one of your generations and its files. The deletion is permanent and cannot be undone, so confirm the exact id with the user before you call this. Requires a paid account. Returns a confirmation message.',
    inputSchema: zodToJsonSchema(GenerationsDeleteToolInputSchema),
  };
}

export async function handleGenerationsDeleteTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GENERATIONS DELETE TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsDeleteToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.deleteGeneration(validatedArgs.generation_id, client);

    return {
      content: [{ type: 'text', text: result.message } as TextContent],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error deleting generation: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Generations Share Tool ──

const GenerationsShareToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of the generation to make public.'),
});

export function buildGenerationsShareToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_generations_share',
    description:
      'Make one of your generations publicly visible and return its permanent share URL. Use this when the user wants a link other people can open. This exposes the image publicly, so ask first if the intent is unclear.',
    inputSchema: zodToJsonSchema(GenerationsShareToolInputSchema),
  };
}

export async function handleGenerationsShareTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GENERATIONS SHARE TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsShareToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.shareGeneration(validatedArgs.generation_id, client);

    const text = [
      'Generation shared successfully.',
      `- Public: ${result.isPublic}`,
      `- Share URL: ${result.shareUrl}`,
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
          text: `Error sharing generation: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Generations Download Tool ──

const GenerationsDownloadToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of one of your generations, as returned by svgmaker_generations_list.'),
  output_path: z
    .string()
    .min(1, 'Output path cannot be empty.')
    .optional()
    .describe(
      'Absolute file path to save the download to, e.g. "/Users/me/Desktop/panda.svg". Give it the extension that matches format. Omit it to get an SVGMaker-hosted download URL instead of a file. Stdio transport only.'
    ),
  format: z
    .enum(['svg', 'webp', 'png', 'svg-optimized', 'svgz'])
    .optional()
    .describe(
      'Output format: svg (source vector), svg-optimized (smaller vector), svgz (gzipped vector), png or webp (raster). Defaults to webp.'
    ),
  optimize: z
    .boolean()
    .optional()
    .describe('Optimize the vector before gzip compression. Applies to the svgz format only.'),
});

export function buildGenerationsDownloadToolDefinition(ctx: ToolContext) {
  const isHttp = ctx.transport === 'http';
  return {
    name: 'svgmaker_generations_download',
    description: isHttp
      ? 'Download one of your generations in a chosen format and get back a time-limited SVGMaker-hosted URL for the file. Formats: svg, svg-optimized, svgz, png, webp. Requires a paid account. Give the returned URL to the user, or fetch it yourself; the download cannot be written anywhere for you. Use svgmaker_generations_preview instead when you only need to look at the image.'
      : 'Download one of your generations in a chosen format. Saves the file to output_path when you pass one, otherwise returns a time-limited SVGMaker-hosted download URL. Formats: svg, svg-optimized, svgz, png, webp. Requires a paid account. Use svgmaker_generations_preview instead when you only need to look at the image.',
    // The runtime schema keeps output_path so the guard can answer a stale client.
    inputSchema: zodToJsonSchema(
      isHttp
        ? GenerationsDownloadToolInputSchema.omit({ output_path: true })
        : GenerationsDownloadToolInputSchema
    ),
  };
}

export async function handleGenerationsDownloadTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GENERATIONS DOWNLOAD TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsDownloadToolInputSchema.parse(request.params.arguments);

    const outputPathRejection = rejectOutputPathOverHttp(validatedArgs.output_path, ctx);
    if (outputPathRejection) return outputPathRejection;

    const validatedOutputPath = validatedArgs.output_path
      ? await fileUtils.resolveAndValidatePath(validatedArgs.output_path, 'write')
      : undefined;

    // Build SDK params with only defined fields
    const params: Record<string, any> = {};
    if (validatedArgs.format !== undefined) params.format = validatedArgs.format;
    if (validatedArgs.optimize !== undefined) params.optimize = validatedArgs.optimize;

    const result = await svgmakerService.downloadGeneration(
      validatedArgs.generation_id,
      Object.keys(params).length > 0 ? params : undefined,
      client
    );

    if (!validatedOutputPath) {
      // Cloud mode: return the SVGMaker-hosted download URL, no disk writes.
      if (!result.url) {
        throw new Error('SVGMaker API did not return a hosted URL.');
      }
      return buildUrlResult('Generation download ready.', result.url, result.urlExpiresIn);
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
          text: `File downloaded successfully: ${validatedOutputPath} (format: ${result.format})`,
        } as TextContent,
      ],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error downloading generation: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Generations Preview Tool ──

const GenerationsPreviewToolInputSchema = z.object({
  generation_id: z
    .string()
    .min(1, 'Generation ID is required')
    .describe('Id of one of your generations, as returned by svgmaker_generations_list.'),
});

export function buildGenerationsPreviewToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_generations_preview',
    description:
      'Show one of your generations in the conversation as a PNG image. Use this to check what a generation looks like, on any transport. Use svgmaker_generations_download instead when the user wants the file or a URL, and svgmaker_gallery_preview for a public gallery item.',
    inputSchema: zodToJsonSchema(GenerationsPreviewToolInputSchema),
  };
}

export async function handleGenerationsPreviewTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG GENERATIONS PREVIEW TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsPreviewToolInputSchema.parse(request.params.arguments);

    const result = await svgmakerService.downloadGeneration(
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
          text: `Error previewing generation: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
