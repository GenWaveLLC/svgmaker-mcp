import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import type { ToolContext } from '../types/toolContext.js';
import { downloadGeneration, getAccountInfo, getGeneration } from '../services/svgmakerService.js';
import { GALLERY_URL, GENERATIONS_URL, publicPreviewUrl, shareUrl } from '../chatgpt/widgets.js';
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
  downloadUrl?: string;
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
  'The user already sees this file in an SVGMaker card with a download button and the credits. Reply with one short sentence, such as "Here is your SVG.", and nothing else. Never write the generation id: keep it only for later edits. Do not show, describe or list details of the image, and do not mention credits. Give the SVGMaker link above only if the user asks for a link.';

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
    downloadUrl:
      new URL(url).origin === new URL(GENERATIONS_URL).origin
        ? `${url}${url.includes('?') ? '&' : '?'}download=1`
        : undefined,
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
    logToFile('Could not read credit balances');
  }
  if (generation.status === 'rejected') {
    logToFile('Could not read generation');
  } else if (generationId && generation.value?.isPublic) {
    card.shareUrl = shareUrl(generationId);
  }
  if (preview.status === 'fulfilled') {
    card.preview = preview.value;
  } else {
    logToFile('Could not make card preview');
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

/** One thumbnail in the ChatGPT list card. */
export interface ListCardItem {
  id: string;
  /** WebP data URL; left out when the image could not be read. */
  preview?: string;
  /** The image's public page, or the generations page for a private image. */
  url: string;
}

/** What only the ChatGPT list card gets, in the result's `_meta`. */
export interface ListCard {
  items: ListCardItem[];
  /** Where to see every image: the generations page or the gallery. */
  moreUrl: string;
}

export const LIST_CARD_META_KEY = 'svgmaker/list';

// Each thumbnail is a fetch (and for a private image an API call), so the card shows only the first few.
const LIST_CARD_LIMIT = 12;
const THUMBNAIL_SIZE = 256;

const LIST_CARD_NOTE =
  'The user already sees these images as thumbnails in an SVGMaker card. Reply with one short sentence and nothing else. Never write the ids: keep them for later calls.';

/** A thumbnail for one of the caller's generations: its public preview, else a private download. */
async function generationThumbnail(id: string, client?: SVGMakerClient): Promise<ListCardItem> {
  try {
    const preview = await fetchCardPreview(publicPreviewUrl(id), THUMBNAIL_SIZE);
    return { id, preview, url: shareUrl(id) };
  } catch {
    // A private image has no public preview.
  }
  try {
    const { url } = await downloadGeneration(id, { format: 'webp' }, client);
    return { id, preview: await fetchCardPreview(url, THUMBNAIL_SIZE), url: GENERATIONS_URL };
  } catch {
    logToFile('Could not make thumbnail');
    return { id, url: GENERATIONS_URL };
  }
}

/** A thumbnail for a public gallery item. */
async function galleryThumbnail(id: string): Promise<ListCardItem> {
  try {
    return {
      id,
      preview: await fetchCardPreview(publicPreviewUrl(id), THUMBNAIL_SIZE),
      url: shareUrl(id),
    };
  } catch {
    logToFile('Could not make thumbnail');
    return { id, url: shareUrl(id) };
  }
}

/**
 * Build a list tool's result. The text lists the ids for the model; on the
 * ChatGPT endpoint the list card also gets thumbnails of the first few in `_meta`.
 */
export async function buildListResult(
  text: string,
  ids: string[],
  source: 'generations' | 'gallery',
  client: SVGMakerClient | undefined,
  ctx: ToolContext
): Promise<{ content: TextContent[]; _meta?: Record<string, ListCard> }> {
  if (!ctx.chatgpt) {
    return { content: [{ type: 'text', text } as TextContent] };
  }
  const items = await Promise.all(
    ids
      .slice(0, LIST_CARD_LIMIT)
      .map((id) => (source === 'gallery' ? galleryThumbnail(id) : generationThumbnail(id, client)))
  );
  const card: ListCard = {
    items,
    moreUrl: source === 'gallery' ? GALLERY_URL : GENERATIONS_URL,
  };
  return {
    content: [{ type: 'text', text: `${text}\n${LIST_CARD_NOTE}` } as TextContent],
    _meta: { [LIST_CARD_META_KEY]: card },
  };
}

// Entitlement errors explain availability without directing users into a purchase flow.
const OUT_OF_CREDITS_NOTE =
  'This action is unavailable because the connected SVGMaker account has insufficient credits. No image was created. Do not promote purchases or upgrades.';

/**
 * Build the error result of a file-making tool. On the ChatGPT endpoint an
 * out-of-credits error explains why the requested action is unavailable.
 */
export function buildErrorResult(
  text: string,
  error: unknown,
  ctx: ToolContext
): { isError: true; content: TextContent[] } {
  // The SDK's retry wrapper rethrows as AbortError with only the message, so match the message too.
  const err = error as { name?: string; message?: string } | undefined;
  const outOfCredits =
    ctx.chatgpt &&
    (err?.name === 'InsufficientCreditsError' || /insufficient credits/i.test(err?.message ?? ''));
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: outOfCredits ? OUT_OF_CREDITS_NOTE : text,
      } as TextContent,
    ],
  };
}
