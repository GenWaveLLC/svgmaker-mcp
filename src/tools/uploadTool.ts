import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import { DEFAULT_TOOL_CONTEXT, type ToolContext } from '../types/toolContext.js';
import * as svgmakerService from '../services/svgmakerService.js';
import { logToFile } from '../utils/logUtils.js';

const UploadToolInputSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename cannot be empty.')
    .describe(
      'Name of the file you are about to upload, including its extension, e.g. "logo.png". The extension determines the image type. The stored object name is generated server-side.'
    ),
  size: z
    .number()
    .int()
    .positive()
    .describe('Size of the file in bytes. Files larger than 25 MB are rejected.'),
  content_type: z
    .string()
    .min(1, 'Content type cannot be empty.')
    .optional()
    .describe(
      'Optional MIME type override, e.g. "image/png". Only needed when the filename has no extension or a misleading one — otherwise leave it out and it is inferred.'
    ),
});

export const uploadToolDefinition = {
  name: 'svgmaker_upload',
  description:
    'Mints a signed upload link so a local file can be used with svgmaker_edit, svgmaker_convert or svgmaker_remove_background over the HTTPS transport. Returns a put_url to upload the file bytes to and a file_url to pass back as `input`. No bytes pass through this server — you perform the upload yourself.',
  inputSchema: zodToJsonSchema(UploadToolInputSchema),
};

export async function handleUploadTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG UPLOAD TICKET TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = UploadToolInputSchema.parse(request.params.arguments);

    const ticket = await svgmakerService.createUploadTicket(
      {
        filename: validatedArgs.filename,
        size: validatedArgs.size,
        contentType: validatedArgs.content_type,
      },
      client
    );

    return {
      content: [
        {
          type: 'text',
          text: [
            'Upload link created.',
            `put_url: ${ticket.putUrl}`,
            `file_url: ${ticket.fileUrl}`,
            '',
            'Next steps:',
            `1. PUT the file bytes to put_url. Send the Content-Type header exactly as shown — it is bound into the signature, and any other value fails with an opaque GCS SignatureDoesNotMatch error:`,
            `   curl -X PUT -H "Content-Type: ${ticket.contentType}" --upload-file <local file> "<put_url>"`,
            '2. Call svgmaker_edit, svgmaker_convert or svgmaker_remove_background with input set to file_url.',
          ].join('\n'),
        } as TextContent,
      ],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error creating upload link: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
