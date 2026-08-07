import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ImageContent, TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import { DEFAULT_TOOL_CONTEXT, type ToolContext } from '../types/toolContext.js';
import { logToFile } from '../utils/logUtils.js';
import { readLocalPreview } from '../utils/previewUtils.js';

const PreviewToolInputSchema = z
  .object({
    input: z
      .string()
      .min(1, 'Input is required.')
      .optional()
      .describe(
        'Absolute path to a local image file to preview. Supports PNG, SVG, WebP, and SVGZ formats. Local files are only readable over the stdio transport.'
      ),
    file_path: z
      .string()
      .min(1, 'File path is required.')
      .optional()
      .describe('Deprecated alias for `input`. Prefer `input`.'),
  })
  .refine((data) => Boolean(data.input) !== Boolean(data.file_path), {
    message: 'Provide exactly one of input or file_path.',
  });

export const previewToolDefinition = {
  name: 'svgmaker_preview',
  description:
    'Previews a local image file by returning it directly in the chat context. Supports PNG, SVG, WebP, and SVGZ formats.',
  inputSchema: zodToJsonSchema(PreviewToolInputSchema),
};

export async function handlePreviewTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  _client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG PREVIEW TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = PreviewToolInputSchema.parse(request.params.arguments);
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
