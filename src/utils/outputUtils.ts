import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from '../types/toolContext.js';

export const HTTP_OUTPUT_PATH_ERROR =
  'output_path is not supported over the HTTPS transport. Call the tool again without output_path: the result comes back as an SVGMaker-hosted URL, and you should give that URL to the user or fetch it yourself.';

/**
 * Reject `output_path` over HTTP. Writing it would auto-create directories inside
 * the container and report success for a file that dies with the container.
 *
 * Returns an error result to be returned as-is, or undefined when the write is allowed.
 */
export function rejectOutputPathOverHttp(
  outputPath: string | undefined,
  ctx: ToolContext
): { isError: true; content: TextContent[] } | undefined {
  if (!outputPath || ctx.transport !== 'http') {
    return undefined;
  }
  return {
    isError: true,
    content: [{ type: 'text', text: HTTP_OUTPUT_PATH_ERROR } as TextContent],
  };
}

/**
 * Build an MCP text result that returns a hosted URL instead of a saved file.
 * Used in cloud/HTTP mode when no local output path is provided.
 */
export function buildUrlResult(
  description: string,
  url: string,
  expiresIn?: string
): { content: TextContent[] } {
  const expiryNote = expiresIn ? ` (URL expires in ${expiresIn})` : '';
  return {
    content: [
      {
        type: 'text',
        text: `${description}\nURL: ${url}${expiryNote}`,
      } as TextContent,
    ],
  };
}
