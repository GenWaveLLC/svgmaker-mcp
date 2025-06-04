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
    debug: false, // Disable debug mode
  };

  // Add baseUrl to config if provided
  if (baseUrl) {
    config.baseUrl = baseUrl;
  } else {
    console.log('No custom base URL provided, using SDK default');
  }

  svgMaker = new SVGMakerClient(apiKey, config);

  // Log configuration
  console.log('SVGMaker SDK Configuration:', {
    baseUrl: config.baseUrl || 'default',
    rateLimit,
    logging: config.logging,
  });
}

export async function generateSVG(
  params: SVGMakerTypes.GenerateParams
): Promise<SVGMakerTypes.GenerateResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  const configuredParams = { ...params, svgText: true };
  const result = await svgMaker.generate.configure(configuredParams).execute();
  return result;
}

export async function editSVG(
  params: SVGMakerTypes.EditParams
): Promise<SVGMakerTypes.EditResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  const configuredParams = { ...params, svgText: true };
  const result = await svgMaker.edit.configure(configuredParams).execute();
  return result;
}

export async function convertImageToSVG(
  params: SVGMakerTypes.ConvertParams
): Promise<SVGMakerTypes.ConvertResponse> {
  if (!svgMaker) throw new Error('SVGMakerService not initialized.');
  const configuredParams = { ...params, svgText: true };
  const result = await svgMaker.convert.configure(configuredParams).execute();
  return result;
}
