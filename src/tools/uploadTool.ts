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
      'Name of the local file you are about to upload, with its extension, e.g. "logo.png". Name only, not a path — the file bytes are never sent to this tool.'
    ),
});

export function buildUploadToolDefinition(_ctx: ToolContext) {
  return {
    name: 'svgmaker_upload',
    description:
      'Create a short-lived upload URL so a local image can be used with svgmaker_edit, svgmaker_convert or svgmaker_remove_background over HTTPS. This tool only mints the URL — you must upload the bytes yourself, in three steps. ' +
      '1. Call this tool with the file name: {"filename": "logo.png"}. It returns upload_url and expires_in. ' +
      '2. Send the file to that URL yourself: curl -X POST -F "file=@/Users/me/logo.png" "<upload_url>". ' +
      '3. Read data.upload_id from the JSON response, e.g. "upl_2f1c8a4e-6b3d-4c9a-8e7f-0a1b2c3d4e5f", and pass it as input: {"input": "upl_2f1c8a4e-6b3d-4c9a-8e7f-0a1b2c3d4e5f", "prompt": "make it blue"}. ' +
      'Upload immediately, the URL expires within minutes. Do not call this for an https:// image URL or an SVGMaker generation id — pass those straight as input.',
    inputSchema: zodToJsonSchema(UploadToolInputSchema),
  };
}

export async function handleUploadTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } },
  client?: SVGMakerClient,
  _ctx: ToolContext = DEFAULT_TOOL_CONTEXT
) {
  logToFile('========== SVG UPLOAD TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = UploadToolInputSchema.parse(request.params.arguments);

    const preparedUpload = await svgmakerService.prepareUpload(
      { filename: validatedArgs.filename },
      client
    );

    return {
      content: [
        {
          type: 'text',
          text: [
            'Temporary upload URL created.',
            `upload_url: ${preparedUpload.uploadUrl}`,
            `expires_in: ${preparedUpload.expiresIn} seconds`,
            '',
            'Next steps:',
            `1. Upload the local file before this URL expires:`,
            '   curl -X POST -F "file=@<local file>" "<upload_url>"',
            '2. Read data.upload_id from the JSON response, e.g. "upl_2f1c8a4e-6b3d-4c9a-8e7f-0a1b2c3d4e5f".',
            '3. Call svgmaker_edit, svgmaker_convert or svgmaker_remove_background with input set to that upload id.',
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
          text: `Error preparing upload: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
