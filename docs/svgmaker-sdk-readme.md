# SVGMaker SDK for Node.js

Official Node.js SDK for the [SVGMaker](https://svgmaker.io) API, providing a clean, type-safe interface for generating, editing, and converting SVG graphics using AI.

[![npm version](https://img.shields.io/npm/v/svgmaker-sdk.svg)](https://www.npmjs.com/package/svgmaker-sdk)
[![License](https://img.shields.io/npm/l/svgmaker-sdk.svg)](https://github.com/GenWaveLLC/svgmaker-sdk-node/blob/main/LICENSE)

## Features

- 🎨 **Complete API Coverage**: Generate, edit, and convert SVGs with AI
- 🧰 **TypeScript Native**: Full type safety with comprehensive type definitions  
- ⚙️ **Configuration-Based**: Clean, object-based parameter configuration
- 🔄 **Automatic Retries**: Built-in retry logic with exponential backoff
- 🌊 **Streaming Support**: Real-time progress updates via Server-Sent Events
- ✅ **Input Validation**: Zod-based schema validation for all requests
- 📦 **Dual Package**: ESM and CommonJS support with proper exports
- 🔌 **Extensible**: Request/response interceptors for customization

## Installation

```bash
npm install svgmaker-sdk
```

## Quick Start

```typescript
import { SVGMakerClient } from 'svgmaker-sdk';

// Initialize client
const client = new SVGMakerClient('your-api-key');

// Generate an SVG
const result = await client.generate
  .configure({
    prompt: 'A minimalist mountain landscape',
    quality: 'high',
    styleParams: {
      style: 'minimalist',
    },
    svgText: true, // Get SVG source code
  })
  .execute();

console.log('SVG URL:', result.svgUrl);
console.log('Credits used:', result.creditCost);
```

## Core API

### Client Initialization

```typescript
// Basic client
const client = new SVGMakerClient('your-api-key');

// Client with custom configuration
const client = new SVGMakerClient('your-api-key', {
  timeout: 60000,
  maxRetries: 5,
  logging: true,
});
```

### Generate SVG

Create SVGs from text descriptions using AI.

```typescript
const result = await client.generate
  .configure({
    prompt: 'A geometric mountain landscape with sun',
    quality: 'high',
    aspectRatio: 'landscape',
    styleParams: {
      style: 'minimalist',
      color_mode: 'monochrome',
      composition: 'center-object',
      advanced: {
        stroke_weight: 'thin',
        corner_style: 'rounded',
        shadow_effect: 'none'
      }
    },
    base64Png: true, // Include PNG preview
    svgText: true,   // Include SVG source
  })
  .execute();

// Access results
console.log('SVG URL:', result.svgUrl);
console.log('Credits used:', result.creditCost);
console.log('Revised prompt:', result.revisedPrompt);

if (result.pngImageData) {
  // PNG preview as Buffer
  console.log('PNG size:', result.pngImageData.length, 'bytes');
}

if (result.svgText) {
  // SVG source code
  console.log('SVG content:', result.svgText);
}
```

#### Generation Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | `string` | - | **Required.** Description of the SVG to generate |
| `quality` | `'low' \| 'medium' \| 'high'` | `'medium'` | Generation quality level |
| `aspectRatio` | `'auto' \| 'portrait' \| 'landscape' \| 'square' \| 'wide' \| 'tall'` | `'auto'` for low/medium, `'square'` for high | Output aspect ratio. **Note:** Low and medium quality only support `'auto'`, `'portrait'`, `'landscape'`, `'square'`. High quality supports all options except `'auto'` |
| `background` | `'auto' \| 'transparent' \| 'opaque'` | `'auto'` | Background type |
| `styleParams` | `StyleParams` | `{}` | Style parameters object (see StyleParams table below) |
| `base64Png` | `boolean` | `false` | Include PNG preview in response |
| `svgText` | `boolean` | `false` | Include SVG source code in response |

#### StyleParams Object

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `style` | `'minimalist' \| 'cartoon' \| 'realistic' \| 'abstract' \| 'flat' \| 'isometric'` | `none` | Art style preference |
| `color_mode` | `'monochrome' \| '2-colors' \| '3-colors' \| 'full-color'` | `none` | Color scheme preference |
| `image_complexity` | `'simple' \| 'detailed'` | `none` | Complexity level |
| `category` | `'icon' \| 'illustration' \| 'pattern' \| 'logo' \| 'scene'` | `none` | Content category |
| `composition` | `'center-object' \| 'full-scene'` | `none` | Layout composition |
| `advanced` | `AdvancedStyleParams` | `{}` | Advanced styling parameters (see AdvancedStyleParams table below) |

#### AdvancedStyleParams Object

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `stroke_weight` | `'thin' \| 'medium' \| 'thick'` | `none` | Stroke weight for lines and shapes |
| `corner_style` | `'none' \| 'rounded' \| 'sharp'` | `none` | Corner style for shapes |
| `shadow_effect` | `'none' \| 'soft' \| 'hard'` | `none` | Shadow effect type |

### Edit SVG/Image

Modify existing images or SVGs using AI-powered editing.

```typescript
// Basic editing
const result = await client.edit
  .configure({
    image: './input.png',
    prompt: 'Add a red border and make it more vibrant',
    quality: 'medium',
    base64Png: true,
    svgText: true,
  })
  .execute();

// Advanced editing with style parameters
const result = await client.edit
  .configure({
    image: fs.readFileSync('./input.svg'),
    prompt: 'Make this more cartoonish',
    styleParams: {
      style: 'cartoon',
      color_mode: '3-colors',
      advanced: {
        stroke_weight: 'medium',
        corner_style: 'rounded'
      }
    },
    mask: './mask.png', // Optional mask for targeted editing
  })
  .execute();
```

#### Edit Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image` | `string \| Buffer \| Readable` | - | **Required.** Image file to edit (file path, Buffer, or Readable stream) |
| `prompt` | `string` | - | **Required.** Edit instructions as a simple text string |
| `styleParams` | `StyleParams` | `{}` | Style parameters object (see StyleParams table above) |
| `mask` | `string \| Buffer \| Readable` | `none` | Optional mask for targeted editing (file path, Buffer, or Readable stream) |
| `quality` | `'low' \| 'medium' \| 'high'` | `'medium'` | Processing quality |
| `aspectRatio` | `'auto' \| 'portrait' \| 'landscape' \| 'square' \| 'wide' \| 'tall'` | `'auto'` for low/medium, `'square'` for high | Output aspect ratio. **Note:** Low and medium quality only support `'auto'`, `'portrait'`, `'landscape'`, `'square'`. High quality supports all options except `'auto'` |
| `background` | `'auto' \| 'transparent' \| 'opaque'` | `'auto'` | Background handling |
| `base64Png` | `boolean` | `false` | Include PNG preview in response |
| `svgText` | `boolean` | `false` | Include SVG source code in response |

### Convert Image to SVG

Convert raster images to vector SVG format.

```typescript
const result = await client.convert
  .configure({
    file: './photo.jpg',
    svgText: true,
  })
  .execute();

console.log('Original:', result.originalImageUrl);
console.log('SVG:', result.svgUrl);
console.log('SVG source:', result.svgText);
```

## Streaming Responses

All operations support real-time progress updates via streaming.

```typescript
const stream = client.generate
  .configure({
    prompt: 'A detailed cityscape illustration',
    quality: 'high',
  })
  .stream();

for await (const event of stream) {
  switch (event.status) {
    case 'processing':
      console.log(`Progress: ${event.message}`);
      break;
    case 'complete':
      console.log(`Complete! SVG: ${event.svgUrl}`);
      break;
    case 'error':
      console.error(`Error: ${event.error}`);
      break;
  }
}
```

## Configuration

### Client Configuration

```typescript
interface SVGMakerConfig {
  apiKey: string;                    // API authentication key
  baseUrl: string;                   // API base URL (default: "https://svgmaker.io/api")
  timeout: number;                   // Request timeout ms (default: 30000)
  maxRetries: number;                // Max retry attempts (default: 3)
  retryBackoffFactor: number;        // Retry delay factor ms (default: 300)
  retryStatusCodes: number[];        // Status codes to retry (default: [408, 429, 500, 502, 503, 504])
  logging: boolean;                  // Enable request logging (default: false)
  logLevel: 'debug' | 'info' | 'warn' | 'error'; // Log level (default: "info")
  caching: boolean;                  // Enable response caching (default: false)
  cacheTTL: number;                  // Cache TTL ms (default: 300000)
  rateLimit: number;                 // Requests per minute (default: 60)
}
```

### Example Configuration

```typescript
const client = new SVGMakerClient('your-api-key', {
  timeout: 60000,
  maxRetries: 5,
  logging: true,
  logLevel: 'debug',
  caching: true,
  cacheTTL: 600000, // 10 minutes
});
```

## Logging

The SDK includes built-in logging functionality for debugging and monitoring API requests.

### Enable Logging

```typescript
// Basic logging
const client = new SVGMakerClient('your-api-key', {
  logging: true,
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
});

// Development (verbose)
const client = new SVGMakerClient('your-api-key', {
  logging: true,
  logLevel: 'debug',
});

// Production (errors only)
const client = new SVGMakerClient('your-api-key', {
  logging: true,
  logLevel: 'error',
});
```

### Log Output

```
[SVGMaker SDK][2024-01-15T10:30:45.123Z][INFO] SVGMaker SDK initialized
[SVGMaker SDK][2024-01-15T10:30:46.250Z]Making API request to /generate
```

### Runtime Configuration

```typescript
// Change log level during runtime
client.setConfig({
  logging: true,
  logLevel: 'warn',
});
```

## Error Handling

The SDK provides comprehensive error handling with custom error types.

```typescript
import { SVGMakerClient, Errors } from 'svgmaker-sdk';

try {
  const result = await client.generate
    .configure({ prompt: 'A landscape' })
    .execute();
} catch (error) {
  if (error instanceof Errors.ValidationError) {
    console.error('Invalid parameters:', error.message);
  } else if (error instanceof Errors.APIError) {
    console.error('API error:', error.message, error.statusCode);
  } else if (error instanceof Errors.RateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter, 'seconds');
  } else if (error instanceof Errors.AuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof Errors.TimeoutError) {
    console.error('Request timed out after:', error.timeout, 'ms');
  } else if (error instanceof Errors.NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof Errors.InsufficientCreditsError) {
    console.error('Insufficient credits. Required:', error.creditsRequired);
  } else if (error instanceof Errors.ContentSafetyError) {
    console.error('Content safety violation:', error.message);
  } else if (error instanceof Errors.FileSizeError) {
    console.error('File too large:', error.message);
  } else if (error instanceof Errors.FileFormatError) {
    console.error('Unsupported file format:', error.message);
  }
}
```

## Advanced Features

### Request/Response Interceptors

Customize requests and responses with interceptors.

```typescript
// Add request interceptor
client.addRequestInterceptor(async (request) => {
  console.log('Making request:', request.url);
  return request;
});

// Add response interceptor
client.addResponseInterceptor(async (response) => {
  console.log('Received response:', response);
  return response;
});
```

### Dynamic Configuration

Update client configuration at runtime.

```typescript
// Update configuration
client.setConfig({
  timeout: 120000,
  maxRetries: 2,
});

// Get current configuration
const config = client.getConfig();
console.log('Current timeout:', config.timeout);
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions.

```typescript
import { SVGMakerClient, Types } from 'svgmaker-sdk';

// Typed parameters
const generateParams: Types.GenerateParams = {
  prompt: 'A minimalist logo',
  quality: 'high',
  style: 'minimalist',
  color_mode: 'monochrome',
};

// Typed responses
const result: Types.GenerateResponse = await client.generate
  .configure(generateParams)
  .execute();

// Type-safe access
console.log(result.svgUrl);      // string
console.log(result.creditCost);  // number
console.log(result.pngImageData); // Buffer | undefined
```

## Package Structure

```
svgmaker-sdk/
├── dist/
│   ├── cjs/         # CommonJS build
│   ├── esm/         # ES Module build
│   └── types/       # TypeScript declarations
├── src/
│   ├── core/        # Core client implementation
│   ├── clients/     # API-specific clients
│   ├── types/       # TypeScript definitions
│   ├── errors/      # Custom error classes
│   └── utils/       # Utility functions
└── examples/        # Usage examples
```

## Browser Compatibility

The SDK is designed for Node.js environments and requires Node.js 16.0.0 or higher. For browser usage, consider the potential limitations with file system operations and ensure proper bundling configuration.

## Contributing

We welcome contributions! Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

## License

MIT License - see the [`LICENSE`](LICENSE) file for details.

## Support

- **Documentation**: [API Documentation](docs/api-documentation.md)
- **Issues**: [GitHub Issues](https://github.com/GenWaveLLC/svgmaker-sdk-node/issues)
- **Repository**: [GitHub Repository](https://github.com/GenWaveLLC/svgmaker-sdk-node)
