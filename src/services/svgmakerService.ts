import { SVGMakerClient, Types as SVGMakerTypes } from '@genwave/svgmaker-sdk';

let svgMaker: SVGMakerClient;

export function createSvgmakerClient(
  apiKey: string,
  rateLimitRpmStr?: string,
  baseUrl?: string
): SVGMakerClient {
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

  return new SVGMakerClient(apiKey, config);
}

export function initializeSvgmakerService(
  apiKey: string,
  rateLimitRpmStr?: string,
  baseUrl?: string
) {
  svgMaker = createSvgmakerClient(apiKey, rateLimitRpmStr, baseUrl);
}

export async function generateSVG(
  params: SVGMakerTypes.GenerateParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GenerateResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  const configuredParams = {
    ...params,
    svgText: !params.raster,
    storage: params.raster ? false : (params.storage ?? true),
  };
  const result = await c.generate.configure(configuredParams).execute();
  return result;
}

export async function editSVG(
  params: SVGMakerTypes.EditParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.EditResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  const configuredParams = {
    ...params,
    svgText: !params.raster,
    storage: params.raster ? false : (params.storage ?? true),
  };
  const result = await c.edit.configure(configuredParams).execute();
  return result;
}

export async function convertImageToSVG(
  params: SVGMakerTypes.AiVectorizeParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.AiVectorizeResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  const configuredParams = { ...params, svgText: true, storage: true };
  const result = await c.convert.aiVectorize.configure(configuredParams).execute();
  return result;
}

export async function getAccountInfo(
  client?: SVGMakerClient
): Promise<SVGMakerTypes.AccountResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.account.getInfo();
}

export async function getAccountUsage(
  params?: SVGMakerTypes.AccountUsageParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.AccountUsageResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.account.getUsage(params);
}

export async function listGenerations(
  params?: SVGMakerTypes.GenerationsListParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GenerationsListResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.generations.list(params);
}

export async function getGeneration(
  id: string,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GenerationResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.generations.get(id);
}

export async function deleteGeneration(
  id: string,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GenerationDeleteResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.generations.delete(id);
}

export async function shareGeneration(
  id: string,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GenerationShareResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.generations.share(id);
}

export async function downloadGeneration(
  id: string,
  params?: SVGMakerTypes.GenerationDownloadParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GenerationDownloadResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.generations.download(id, params);
}

export async function listGallery(
  params?: SVGMakerTypes.GalleryListParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GalleryListResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.gallery.list(params);
}

export async function getGalleryItem(
  id: string,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GalleryItemResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.gallery.get(id);
}

export async function downloadGalleryItem(
  id: string,
  params?: SVGMakerTypes.GalleryDownloadParams,
  client?: SVGMakerClient
): Promise<SVGMakerTypes.GalleryDownloadResponse> {
  const c = client ?? svgMaker;
  if (!c) throw new Error('SVGMakerService not initialized.');
  return await c.gallery.download(id, params);
}
