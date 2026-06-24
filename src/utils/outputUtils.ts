import { TextContent } from '@modelcontextprotocol/sdk/types.js';

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
