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
