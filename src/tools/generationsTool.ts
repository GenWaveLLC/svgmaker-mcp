import fs from 'fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, ImageContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import * as fileUtils from '../utils/fileUtils.js';
import { logToFile } from '../utils/logUtils.js';

// ── Generations List Tool ──

const GenerationsListToolInputSchema = z.object({
  page: z.number().int().positive().optional().describe('Page number (1-indexed)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (1-100)'),
  type: z
    .string()
    .optional()
    .describe('Filter by generation type (e.g., "generate", "edit", "convert")'),
  hashtags: z.array(z.string()).optional().describe('Filter by hashtags'),
  categories: z.array(z.string()).optional().describe('Filter by categories'),
  query: z.string().optional().describe('Search query for prompt/description'),
});

export const generationsListToolDefinition = {
  name: 'svgmaker_generations_list',
  description:
    'Lists your SVG generations with optional filtering and pagination. Returns generation IDs that can be used with other generation tools.',
  inputSchema: zodToJsonSchema(GenerationsListToolInputSchema),
};

export async function handleGenerationsListTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
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
      Object.keys(params).length > 0 ? params : undefined
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
  id: z.string().min(1, 'Generation ID is required'),
});

export const generationsGetToolDefinition = {
  name: 'svgmaker_generations_get',
  description:
    'Gets detailed information about a specific generation by ID, including the prompt used, type, quality level, visibility status, hashtags, and categories.',
  inputSchema: zodToJsonSchema(GenerationsGetToolInputSchema),
};

export async function handleGenerationsGetTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GENERATIONS GET TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsGetToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.getGeneration(validatedArgs.id);

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
  id: z.string().min(1, 'Generation ID is required'),
});

export const generationsDeleteToolDefinition = {
  name: 'svgmaker_generations_delete',
  description:
    'Deletes a generation and its associated files. This action is permanent and cannot be undone. Requires a paid account.',
  inputSchema: zodToJsonSchema(GenerationsDeleteToolInputSchema),
};

export async function handleGenerationsDeleteTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GENERATIONS DELETE TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsDeleteToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.deleteGeneration(validatedArgs.id);

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
  id: z.string().min(1, 'Generation ID is required'),
});

export const generationsShareToolDefinition = {
  name: 'svgmaker_generations_share',
  description:
    'Shares a generation by making it publicly accessible. Returns the public share URL.',
  inputSchema: zodToJsonSchema(GenerationsShareToolInputSchema),
};

export async function handleGenerationsShareTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GENERATIONS SHARE TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsShareToolInputSchema.parse(request.params.arguments);
    const result = await svgmakerService.shareGeneration(validatedArgs.id);

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
  id: z.string().min(1, 'Generation ID is required'),
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

export const generationsDownloadToolDefinition = {
  name: 'svgmaker_generations_download',
  description:
    'Downloads a generation in the specified format and saves it to a local file. Supports SVG, WebP, PNG, optimized SVG, and SVGZ formats. Requires a paid account.',
  inputSchema: zodToJsonSchema(GenerationsDownloadToolInputSchema),
};

export async function handleGenerationsDownloadTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GENERATIONS DOWNLOAD TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsDownloadToolInputSchema.parse(request.params.arguments);

    const validatedOutputPath = await fileUtils.resolveAndValidatePath(
      validatedArgs.output_path,
      [],
      'write'
    );

    // Build SDK params with only defined fields
    const params: Record<string, any> = {};
    if (validatedArgs.format !== undefined) params.format = validatedArgs.format;
    if (validatedArgs.optimize !== undefined) params.optimize = validatedArgs.optimize;

    const result = await svgmakerService.downloadGeneration(
      validatedArgs.id,
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
  id: z.string().min(1, 'Generation ID is required'),
});

export const generationsPreviewToolDefinition = {
  name: 'svgmaker_generations_preview',
  description:
    'Previews a generation by returning the image directly in the chat context as a PNG image. Use this to visually inspect a generation without saving it to disk.',
  inputSchema: zodToJsonSchema(GenerationsPreviewToolInputSchema),
};

export async function handleGenerationsPreviewTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG GENERATIONS PREVIEW TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = GenerationsPreviewToolInputSchema.parse(request.params.arguments);

    const result = await svgmakerService.downloadGeneration(validatedArgs.id, { format: 'png' });

    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch preview: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64Data = buffer.toString('base64');

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
