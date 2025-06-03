import { SVGMakerClient, Types as SVGMakerTypes } from '@genwave/svgmaker-sdk';

let svgMaker: SVGMakerClient;

export function initializeSvgmakerService(apiKey: string, rateLimitRpmStr?: string, baseUrl?: string) {
    const rateLimit = rateLimitRpmStr ? parseInt(rateLimitRpmStr, 10) : 2;
    const config: any = {
        logging: true,  // Enable logging to see API requests
        rateLimit: rateLimit, // RPM
        debug: true    // Enable debug mode if available
    };
    
    // Add baseUrl to config if provided
    if (baseUrl) {
        console.log('Using custom base URL:', baseUrl);
        config.baseUrl = baseUrl;
    } else {
        console.log('No custom base URL provided, using SDK default');
    }
    
    svgMaker = new SVGMakerClient(apiKey, config);

    // Log configuration
    console.log('SVGMaker SDK Configuration:', {
        baseUrl: config.baseUrl || 'default',
        rateLimit,
        logging: config.logging
    });
}

export async function generateSVG(params: SVGMakerTypes.GenerateParams): Promise<SVGMakerTypes.GenerateResponse> {
    if (!svgMaker) throw new Error("SVGMakerService not initialized.");
    try {
        // Ensure svgText is true to get the content
        const configuredParams = { ...params, svgText: true };
        console.log('Sending generate request with params:', configuredParams);
        const result = await svgMaker.generate.configure(configuredParams).execute();
        console.log('Generate request successful');
        return result;
    } catch (error) {
        throw error; // Re-throw to be caught by tool handler
    }
}

export async function editSVG(params: SVGMakerTypes.EditParams): Promise<SVGMakerTypes.EditResponse> {
    if (!svgMaker) throw new Error("SVGMakerService not initialized.");
    try {
        const configuredParams = { ...params, svgText: true };
        const result = await svgMaker.edit.configure(configuredParams).execute();
        return result;
    } catch (error) {
        throw error;
    }
}

export async function convertImageToSVG(params: SVGMakerTypes.ConvertParams): Promise<SVGMakerTypes.ConvertResponse> {
    if (!svgMaker) throw new Error("SVGMakerService not initialized.");
    try {
        const configuredParams = { ...params, svgText: true };
        const result = await svgMaker.convert.configure(configuredParams).execute();
        return result;
    } catch (error) {
        throw error;
    }
}
