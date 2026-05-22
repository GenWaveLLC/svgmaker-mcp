import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ImageContent, TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logToFile } from '../utils/logUtils.js';
import { readLocalPreview } from '../utils/previewUtils.js';

const PreviewToolInputSchema = z.object({
  file_path: z
    .string()
    .min(1, 'File path is required.')
    .describe(
      'Absolute path to a local image file to preview. Supports PNG, SVG, WebP, and SVGZ formats.'
    ),
});

export const previewToolDefinition = {
  name: 'svgmaker_preview',
  description:
    'Previews a local image file by returning it directly in the chat context. Supports PNG, SVG, WebP, and SVGZ formats.',
  inputSchema: zodToJsonSchema(PreviewToolInputSchema),
};

export async function handlePreviewTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG PREVIEW TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = PreviewToolInputSchema.parse(request.params.arguments);
    const base64Data = await readLocalPreview(validatedArgs.file_path);

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
