import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolContext } from '../types/toolContext.js';
import * as fileUtils from './fileUtils.js';

export const HTTP_LOCAL_PATH_ERROR =
  'Local file paths are not supported over the HTTPS transport. Pass an https:// URL, generation id, or upload id. For a local file, call svgmaker_upload and upload it first.';

export const MISSING_INPUT_ERROR =
  'An image source is required: provide "input" as a local file path (stdio only), an https:// URL, an upload id, or a generation id.';

export const GENERATION_ID_UNSUPPORTED_ERROR =
  'Generation ids are not supported for convert, because it would re-vectorize a downscaled preview. Pass a local file path (stdio only), an https:// URL, or an upl_ upload id.';

export const INPUT_PARAM_DESCRIPTION =
  'Image source. Accepts a local absolute file path, an https:// URL, an upl_ upload id, or an SVGMaker generation id (your own generations or public gallery items).';

export const NO_GENERATION_INPUT_PARAM_DESCRIPTION =
  'Image source. Accepts a local absolute file path, an https:// URL, or an upl_ upload id. Generation ids are not accepted.';

// The HTTP variants never mention local paths. An agent that reads only the first
// clause would otherwise send one and get rejected.
export const INPUT_PARAM_DESCRIPTION_HTTP =
  'Image source. Accepts an https:// URL, an upl_ upload id from svgmaker_upload, or an SVGMaker generation id (your own generations or public gallery items). For a file on the user machine, call svgmaker_upload first and pass the upl_ id it gives you.';

export const NO_GENERATION_INPUT_PARAM_DESCRIPTION_HTTP =
  'Image source. Accepts an https:// URL or an upl_ upload id from svgmaker_upload. Generation ids are not accepted. For a file on the user machine, call svgmaker_upload first and pass the upl_ id it gives you.';

export type InputKind = 'path' | 'url' | 'upload' | 'generation';

export interface ImageSource {
  value: string;
  /** Set when the parameter name already asserts the kind (the legacy aliases). */
  kind?: InputKind;
}

export type ResolvedImageInput =
  | { kind: 'path'; buffer: Buffer }
  | { kind: 'url'; imageUrl: string }
  | { kind: 'upload'; uploadId: string }
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
  // Case sensitive: the API only ever mints lowercase upl_ ids, and an
  // uppercase variant classified here would 404 instead of failing clearly.
  if (value.startsWith('upl_')) return 'upload';
  return 'generation';
}

/**
 * Resolve an image source to something the SDK can send. A URL, upload id, or
 * generation id is passed through untouched — the API resolves it, so no image
 * bytes ever transit this server.
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

  if (kind === 'upload') {
    return { kind: 'upload', uploadId: source.value };
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
  } else if (resolved.kind === 'upload') {
    sdkParams.uploadId = resolved.uploadId;
  } else {
    sdkParams.generationId = resolved.generationId;
  }
}
