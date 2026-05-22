import sharp from 'sharp';
import * as fileUtils from './fileUtils.js';

export async function fetchRemotePreview(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch preview: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

export async function readLocalPreview(filePath: string): Promise<string> {
  const validatedPath = await fileUtils.resolveAndValidatePath(filePath, [], 'read');
  const fileBuffer = await fileUtils.readFileToBuffer(validatedPath);
  const ext = validatedPath.split('.').pop()?.toLowerCase();

  if (ext === 'png') {
    return fileBuffer.toString('base64');
  }
  const pngBuffer = await sharp(fileBuffer).png().toBuffer();
  return pngBuffer.toString('base64');
}
