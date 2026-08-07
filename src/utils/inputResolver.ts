import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolContext } from '../types/toolContext.js';
import * as fileUtils from './fileUtils.js';

export const HTTP_LOCAL_PATH_ERROR =
  'Local file paths are not supported over the HTTPS transport. Pass an https:// URL or a generation_id, or call svgmaker_upload to get an upload link for this file.';

export const MISSING_INPUT_ERROR =
  'An image source is required: provide "input" as a local file path (stdio only), an https:// URL, or a generation id.';

export const GENERATION_ID_UNSUPPORTED_ERROR =
  'Generation ids are not supported for convert, because it would re-vectorize a downscaled preview. Pass a local file path (stdio only) or an https:// URL.';

export const INPUT_PARAM_DESCRIPTION =
  'Image source. Accepts a local absolute file path (stdio transport only), an https:// URL, or an SVGMaker generation id (your own generations or public gallery items). Over the HTTPS transport use a URL or generation id — call svgmaker_upload first to get a URL for a local file.';

export const NO_GENERATION_INPUT_PARAM_DESCRIPTION =
  'Image source. Accepts a local absolute file path (stdio transport only) or an https:// URL. Generation ids are not accepted. Over the HTTPS transport use a URL — call svgmaker_upload first to get a URL for a local file.';

export type InputKind = 'path' | 'url' | 'generation';

export interface ImageSource {
  value: string;
  /** Set when the parameter name already asserts the kind (the legacy aliases). */
  kind?: InputKind;
}

export type ResolvedImageInput =
  | { kind: 'path'; buffer: Buffer }
  | { kind: 'url'; imageUrl: string }
  | { kind: 'generation'; generationId: string };

export interface ResolveImageInputOptions {
  /** Defaults to true; convert opts out because the API would feed it a downscaled preview. */
  allowGenerationId?: boolean;
}

export interface ImageSourceArgs {
  input?: string;
  input_path?: string;
  generation_id?: string;
}

/**
 * Pick the single image source from the preferred `input` param and the legacy
 * `input_path` / `generation_id` aliases.
 */
export function selectImageSource(args: ImageSourceArgs): ImageSource {
  const provided: Array<[string, string, InputKind | undefined]> = [];
  if (args.input) provided.push(['input', args.input, undefined]);
  if (args.input_path) provided.push(['input_path', args.input_path, 'path']);
  if (args.generation_id) provided.push(['generation_id', args.generation_id, 'generation']);

  if (provided.length === 0) {
    throw new Error(MISSING_INPUT_ERROR);
  }
  if (provided.length > 1) {
    throw new Error(
      `Provide only one image source, received: ${provided.map(([name]) => name).join(', ')}.`
    );
  }

  const [, value, kind] = provided[0];
  return { value, kind };
}

export function classifyInput(value: string): InputKind {
  if (/^file:\/\//i.test(value)) return 'path';
  if (/^https?:\/\//i.test(value)) return 'url';
  if (path.isAbsolute(value) || /^[.~]/.test(value)) return 'path';
  return 'generation';
}

/**
 * Resolve an image source to something the SDK can send. A URL or generation id is
 * passed through untouched — the API resolves it, so no image bytes ever transit
 * this server.
 */
export async function resolveImageInput(
  source: ImageSource,
  ctx: ToolContext,
  options: ResolveImageInputOptions = {}
): Promise<ResolvedImageInput> {
  const kind = source.kind ?? classifyInput(source.value);

  if (kind === 'url') {
    return { kind: 'url', imageUrl: source.value };
  }

  if (kind === 'generation') {
    if (options.allowGenerationId === false) {
      throw new Error(GENERATION_ID_UNSUPPORTED_ERROR);
    }
    return { kind: 'generation', generationId: source.value };
  }

  if (ctx.transport === 'http') {
    throw new Error(HTTP_LOCAL_PATH_ERROR);
  }

  const rawPath = /^file:\/\//i.test(source.value) ? fileURLToPath(source.value) : source.value;
  const validatedPath = await fileUtils.resolveAndValidatePath(rawPath, 'read');
  return { kind: 'path', buffer: await fileUtils.readFileToBuffer(validatedPath) };
}

/** Apply a resolved input to SDK params under the field name that client expects. */
export function applyImageInput(
  sdkParams: Record<string, any>,
  resolved: ResolvedImageInput,
  fileField: 'image' | 'file'
): void {
  if (resolved.kind === 'path') {
    sdkParams[fileField] = resolved.buffer;
  } else if (resolved.kind === 'url') {
    sdkParams.imageUrl = resolved.imageUrl;
  } else {
    sdkParams.generationId = resolved.generationId;
  }
}
