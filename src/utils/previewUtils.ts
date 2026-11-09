import sharp from 'sharp';
import * as fileUtils from './fileUtils.js';

export const HTTP_LOCAL_PREVIEW_ERROR =
  'Local file paths are not readable over the HTTPS transport. To see an image, call svgmaker_generations_preview with one of your generation ids, or svgmaker_gallery_preview with a gallery item id. Get an id from svgmaker_generations_list or svgmaker_gallery_list, or from the generate/edit/convert result.';

export async function fetchRemotePreview(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch preview: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

/** Fetch a hosted image as a WebP data URL of at most `size` px, for a ChatGPT card to keep after the link expires. */
export async function fetchCardPreview(downloadUrl: string, size = 1024): Promise<string> {
  const buffer = Buffer.from(await fetchRemotePreview(downloadUrl), 'base64');
  // svgmaker.io answers a private image on its public route with a 1x1 placeholder.
  const { width = 0 } = await sharp(buffer).metadata();
  if (width <= 1) throw new Error('Got a placeholder, not the image');
  const webp = await sharp(buffer, { density: 144 })
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  return `data:image/webp;base64,${webp.toString('base64')}`;
}

export async function readLocalPreview(filePath: string): Promise<string> {
  const validatedPath = await fileUtils.resolveAndValidatePath(filePath, 'read');
  const fileBuffer = await fileUtils.readFileToBuffer(validatedPath);
  const ext = validatedPath.split('.').pop()?.toLowerCase();

  if (ext === 'png') {
    return fileBuffer.toString('base64');
  }
  const pngBuffer = await sharp(fileBuffer).png().toBuffer();
  return pngBuffer.toString('base64');
}
