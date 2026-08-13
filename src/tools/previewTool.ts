import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ImageContent, TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import { DEFAULT_TOOL_CONTEXT, type ToolContext } from '../types/toolContext.js';
import { logToFile } from '../utils/logUtils.js';
import { HTTP_LOCAL_PREVIEW_ERROR, readLocalPreview } from '../utils/previewUtils.js';

const PreviewToolInputSchema = z
  .object({
    input: z
      .string()
      .min(1, 'Input is required.')
      .optional()
      .describe(
        'Absolute path to a local image file, e.g. "/Users/me/Desktop/icon.svg". Accepts PNG, SVG, WebP and SVGZ. Readable over the stdio transport only.'
      ),
    file_path: z
      .string()
      .min(1, 'File path is required.')
      .optional()
      .describe('Deprecated alias for `input`. Prefer `input`. Send one of the two, never both.'),
  })
  .refine((data) => Boolean(data.input) !== Boolean(data.file_path), {
    message: 'Provide exactly one of input or file_path.',
  });

export function buildPreviewToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_preview',
    description:
      'Show a local image file (PNG, SVG, WebP or SVGZ) in the conversation as a PNG image. Use this to look at a file already on disk. Works over the stdio transport only, because it reads the local filesystem. To look at an SVGMaker generation or a gallery item, use svgmaker_generations_preview or svgmaker_gallery_preview with an id instead.',
    inputSchema: zodToJsonSchema(PreviewToolInputSchema),
  };
}

export async function handlePreviewTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  _client?: SVGMakerClient,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG PREVIEW TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = PreviewToolInputSchema.parse(request.params.arguments);
    if (ctx.transport === 'http') {
      throw new Error(HTTP_LOCAL_PREVIEW_ERROR);
    }
    const base64Data = await readLocalPreview((validatedArgs.input ?? validatedArgs.file_path)!);

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
          text: `Error previewing file: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
