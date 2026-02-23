# SVGMaker SDK for Node.js

Official Node.js SDK for the [SVGMaker](https://svgmaker.io) API, providing a clean, type-safe interface for generating, editing, and converting SVG graphics using AI.

[![npm version](https://img.shields.io/npm/v/@genwave/svgmaker-sdk.svg)](https://www.npmjs.com/package/@genwave/svgmaker-sdk)
[![License](https://img.shields.io/npm/l/@genwave/svgmaker-sdk.svg)](https://github.com/GenWaveLLC/svgmaker-sdk-node/blob/main/LICENSE)

## Upgrading to v1.0.0

v1.0.0 includes breaking changes. If you're upgrading from v0.x, see the **[Migration Guide](docs/migration-guide-v1.md)** for full details. Top breaking changes:

- **Base URL changed** — now targets `api.svgmaker.io` (automatic if using defaults)
- **`client.convert` restructured** — old `client.convert.configure(...)` is now `client.convert.aiVectorize.configure(...)`, plus new sub-clients for tracing, format conversion, and batch operations
- **`styleParams` redesigned** — new style values (`flat`, `line_art`, `engraving`, `ghibli`, ...), `advanced` block removed, new `text` field added
- **Aspect ratio `wide`/`tall` removed** — only `auto`, `portrait`, `landscape`, `square` remain
- **`model` parameter**: New option on generate and edit — mutually exclusive with `quality`
- **Cloud storage no longer default** — generate, edit, and AI vectorize no longer store results to cloud by default; pass `storage: true` to persist

## Features

- **Complete API Coverage**: Generate, edit, convert, optimize, and manage SVGs
- **TypeScript Native**: Full type safety with comprehensive type definitions
- **Automatic Retries**: Built-in retry logic with exponential backoff
- **Streaming Support**: Real-time progress updates via Server-Sent Events
- **Input Validation**: Zod-based schema validation for all requests
- **Dual Package**: ESM and CommonJS support

## Installation

```bash
npm install @genwave/svgmaker-sdk
```

Requires Node.js 18.0.0 or higher.

## Quick Start

```typescript
import { SVGMakerClient } from '@genwave/svgmaker-sdk';

const client = new SVGMakerClient('your-api-key');

// Generate an SVG
const result = await client.generate
  .configure({
    prompt: 'A minimalist mountain landscape',
    quality: 'high',
    svgText: true,
  })
  .execute();

console.log('SVG URL:', result.svgUrl);
console.log('Credits used:', result.creditCost);

// Edit an existing image
const edited = await client.edit
  .configure({
    image: './input.png',
    prompt: 'Add a red border',
    quality: 'medium',
  })
  .execute();

// AI-powered vectorization
const vectorized = await client.convert.aiVectorize
  .configure({ file: './photo.jpg', svgText: true })
  .execute();

// Stream progress for long operations
const stream = client.generate
  .configure({ prompt: 'A detailed cityscape', quality: 'high' })
  .stream();

for await (const event of stream) {
  if (event.status === 'complete') console.log('Done:', event.svgUrl);
}
```

## Available Clients

| Client | Access | Description |
|--------|--------|-------------|
| `generate` | `client.generate` | Create SVGs from text prompts |
| `edit` | `client.edit` | Modify existing images/SVGs with AI |
| `convert.aiVectorize` | `client.convert.aiVectorize` | AI-powered raster to SVG conversion |
| `convert.trace` | `client.convert.trace` | Algorithmic raster to SVG tracing |
| `convert.svgToVector` | `client.convert.svgToVector` | SVG to vector formats (PDF, EPS, DXF, AI, PS) |
| `convert.rasterToRaster` | `client.convert.rasterToRaster` | Convert between raster formats |
| `convert.batch` | `client.convert.batch` | Batch convert up to 10 files |
| `enhancePrompt` | `client.enhancePrompt` | Improve text prompts using AI |
| `optimizeSvg` | `client.optimizeSvg` | Optimize SVG files using SVGO |
| `generations` | `client.generations` | Manage your generations (list, download, share, delete) |
| `gallery` | `client.gallery` | Browse and download public gallery items |
| `account` | `client.account` | Account info and usage statistics |

Most clients use the `configure().execute()` pattern. `generations`, `gallery`, and `account` use direct methods (e.g., `client.generations.list()`, `client.account.getInfo()`).

## Error Handling

```typescript
import { SVGMakerClient, Errors } from '@genwave/svgmaker-sdk';

try {
  const result = await client.generate
    .configure({ prompt: 'A landscape' })
    .execute();
} catch (error) {
  if (error instanceof Errors.RateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter, 'seconds');
  } else if (error instanceof Errors.InsufficientCreditsError) {
    console.error('Insufficient credits. Required:', error.creditsRequired);
  } else if (error instanceof Errors.AuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof Errors.APIError) {
    console.error('API error:', error.message, error.statusCode);
  }
}
```

See the [SDK Documentation](docs/sdk-documentation.md) for the full list of error types.

## Documentation

- **[Migration Guide](docs/migration-guide-v1.md)** - Upgrading from v0.x to v1.0.0
- **[SDK Documentation](docs/sdk-documentation.md)** - Full SDK reference with detailed examples for every client
- **[API Documentation](docs/v1-api-documentation.md)** - REST API reference with endpoint details and credit costs
- **[Legacy API Documentation](docs/legacy-api-documentation.md)** - Pre-v1 API reference

## Contributing

We welcome contributions! Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

## License

MIT License - see the [`LICENSE`](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/GenWaveLLC/svgmaker-sdk-node/issues)
- **Repository**: [GitHub Repository](https://github.com/GenWaveLLC/svgmaker-sdk-node)
