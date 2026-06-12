import { SVGMakerClient, Types as SVGMakerTypes } from '@genwave/svgmaker-sdk';

let svgMaker: SVGMakerClient;

export function initializeSvgmakerService(
  apiKey: string,
  rateLimitRpmStr?: string,
  baseUrl?: string
) {
  const rateLimit = rateLimitRpmStr ? parseInt(rateLimitRpmStr, 10) : 2;
  const config: any = {
    logging: false, // Disable logging to prevent stdout pollution
    rateLimit: rateLimit, // RPM
    debug: false, // Enable debug mode
    timeout: 180000, // 180s timeout
    maxRetries: 0, // Do not retry requests
  };

  // Add baseUrl to config if provided
  if (baseUrl) {
    config.baseUrl = baseUrl;
  }

  svgMaker = new SVGMakerClient(apiKey, config);
}

export async function generateSVG(
  params: SVGMakerTypes.GenerateParams
): Promise<SVGMakerTypes.GenerateResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  const configuredParams = {
    ...params,
    svgText: !params.raster,
    storage: params.raster ? false : (params.storage ?? true),
  };
  const result = await svgMaker.generate.configure(configuredParams).execute();
  return result;
}

export async function editSVG(
  params: SVGMakerTypes.EditParams
): Promise<SVGMakerTypes.EditResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  const configuredParams = {
    ...params,
    svgText: !params.raster,
    storage: params.raster ? false : (params.storage ?? true),
  };
  const result = await svgMaker.edit.configure(configuredParams).execute();
  return result;
}

export async function convertImageToSVG(
  params: SVGMakerTypes.AiVectorizeParams
): Promise<SVGMakerTypes.AiVectorizeResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  const configuredParams = { ...params, svgText: true, storage: true };
  const result = await svgMaker.convert.aiVectorize.configure(configuredParams).execute();
  return result;
}

export async function getAccountInfo(): Promise<SVGMakerTypes.AccountResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.account.getInfo();
}

export async function getAccountUsage(
  params?: SVGMakerTypes.AccountUsageParams
): Promise<SVGMakerTypes.AccountUsageResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.account.getUsage(params);
}

export async function listGenerations(
  params?: SVGMakerTypes.GenerationsListParams
): Promise<SVGMakerTypes.GenerationsListResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.generations.list(params);
}

export async function getGeneration(id: string): Promise<SVGMakerTypes.GenerationResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.generations.get(id);
}

export async function deleteGeneration(
  id: string
): Promise<SVGMakerTypes.GenerationDeleteResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.generations.delete(id);
}

export async function shareGeneration(id: string): Promise<SVGMakerTypes.GenerationShareResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.generations.share(id);
}

export async function downloadGeneration(
  id: string,
  params?: SVGMakerTypes.GenerationDownloadParams
): Promise<SVGMakerTypes.GenerationDownloadResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.generations.download(id, params);
}

export async function listGallery(
  params?: SVGMakerTypes.GalleryListParams
): Promise<SVGMakerTypes.GalleryListResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.gallery.list(params);
}

export async function getGalleryItem(id: string): Promise<SVGMakerTypes.GalleryItemResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.gallery.get(id);
}

export async function downloadGalleryItem(
  id: string,
  params?: SVGMakerTypes.GalleryDownloadParams
): Promise<SVGMakerTypes.GalleryDownloadResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  return await svgMaker.gallery.download(id, params);
}
