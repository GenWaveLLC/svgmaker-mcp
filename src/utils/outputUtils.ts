import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import type { ToolContext } from '../types/toolContext.js';
import { getAccountInfo, getGeneration } from '../services/svgmakerService.js';
import { GENERATIONS_URL, shareUrl } from '../chatgpt/widgets.js';
import { fetchCardPreview } from './previewUtils.js';
import { logToFile } from './logUtils.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

/** A file a tool made, as `structuredContent`: what the model needs to refer to it again. */
const FileResultSchema = z.object({
  format: z.enum(['svg', 'png']),
  generationId: z.string().optional(),
});

export type FileResult = z.infer<typeof FileResultSchema>;
export const fileResultOutputSchema = zodToJsonSchema(FileResultSchema);

/** What only the ChatGPT result card gets, in the result's `_meta`. The model never sees it. */
export interface FileCard {
  url: string;
  generationsUrl: string;
  /** WebP data URL of the image, saved with the chat so the card still shows it after `url` expires. */
  preview?: string;
  /** Public page of the generation; set only when the generation is public. */
  shareUrl?: string;
  creditsUsed?: number;
  premiumCredits?: number;
  credits?: number;
}

export const FILE_CARD_META_KEY = 'svgmaker/file';

/** The SDK response fields a file result is built from. */
interface FileResponse {
  generationId?: string;
  creditCost?: number;
}

// Without this the model repeats the card below it, sometimes with a stock picture.
const RESULT_CARD_NOTE =
  'The user sees this file in an SVGMaker card with its credits and a download button. Reply in one short sentence and give the SVGMaker link above as a plain text link. Do not show the image, describe it, list its details, or mention the generation id or credits.';

/**
 * Build a tool result for a hosted file. The text carries the URL, as
 * `buildUrlResult` does. On the ChatGPT endpoint the text links the
 * generation's public page when it is public, else the user's generations
 * page, and the card gets the file URL, a preview and both credit balances in
 * `_meta`, which the model never sees.
 */
export async function buildFileResult(
  description: string,
  url: string,
  format: FileResult['format'],
  expiresIn: string | undefined,
  response: FileResponse,
  client: SVGMakerClient | undefined,
  ctx: ToolContext
): Promise<{
  content: TextContent[];
  structuredContent: FileResult;
  _meta?: Record<string, FileCard>;
}> {
  const structuredContent: FileResult = { format, generationId: response.generationId };
  if (!ctx.chatgpt) {
    return { ...buildUrlResult(description, url, expiresIn), structuredContent };
  }

  const card: FileCard = {
    url,
    generationsUrl: GENERATIONS_URL,
    creditsUsed: response.creditCost,
  };
  const { generationId } = response;
  const [account, generation, preview] = await Promise.allSettled([
    getAccountInfo(client),
    generationId ? getGeneration(generationId, client) : Promise.resolve(undefined),
    fetchCardPreview(url),
  ]);
  if (account.status === 'fulfilled') {
    // The API returns premiumCredits even though the SDK type leaves it out.
    const balances = account.value as { credits: number; premiumCredits?: number };
    card.premiumCredits = balances.premiumCredits ?? 0;
    card.credits = balances.credits;
  } else {
    logToFile(`Could not read credit balances: ${account.reason}`);
  }
  if (generation.status === 'rejected') {
    logToFile(`Could not read generation ${generationId}: ${generation.reason}`);
  } else if (generationId && generation.value?.isPublic) {
    card.shareUrl = shareUrl(generationId);
  }
  if (preview.status === 'fulfilled') {
    card.preview = preview.value;
  } else {
    logToFile(`Could not make card preview: ${preview.reason}`);
  }
  const link = card.shareUrl
    ? `SVGMaker page for this image: ${card.shareUrl}`
    : `SVGMaker generations page: ${GENERATIONS_URL}`;
  return {
    content: [
      {
        type: 'text',
        text: `${description}\n${link}\n${RESULT_CARD_NOTE}`,
      } as TextContent,
    ],
    structuredContent,
    _meta: { [FILE_CARD_META_KEY]: card },
  };
}
