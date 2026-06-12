# SVGMaker MCP Server
A powerful MCP server for generating, editing, and converting SVG images using SVGMaker API.

[![Website](https://img.shields.io/badge/Website-SVGMaker.io-blue)](https://svgmaker.io)
[![npm version](https://img.shields.io/npm/v/@genwave/svgmaker-mcp.svg)](https://www.npmjs.com/package/@genwave/svgmaker-mcp)
[![License](https://img.shields.io/npm/l/@genwave/svgmaker-mcp.svg)](https://github.com/GenWaveLLC/svgmaker-mcp/blob/main/LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/GenWaveLLC/svgmaker-mcp/ci.yml?branch=main)](https://github.com/GenWaveLLC/svgmaker-mcp/actions)
[![npm downloads](https://img.shields.io/npm/dm/@genwave/svgmaker-mcp.svg)](https://www.npmjs.com/package/@genwave/svgmaker-mcp)

## 🎨 MCP Server in Action

![MCP Capabilities Demo](docs/mcp-capabilities-demo.svg)

*This very illustration came to life through our own SVGMaker MCP server—a living example of AI assistants and vector graphics working in perfect harmony via the Model Context Protocol.*

## 🌟 Highlights

- **🎨 AI-Powered SVG Generation**: Create SVGs from text descriptions
- **✏️ Smart SVG Editing**: Edit existing SVGs with natural language
- **🖼️ Raster Mode**: Skip vectorization and get a quick PNG instead of SVG
- **🔄 Image-to-SVG Conversion**: Convert any image to scalable SVG
- **👁️ Inline Image Preview**: Preview generations and gallery items directly in chat
- **🔒 Secure File Operations**: Built-in path validation and security
- **⚡ Real-Time Progress**: Live updates during operations
- **📝 Type Safety**: Full TypeScript support with type definitions

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [LLM Integrations](#-llm-integrations)
- [Available Tools](#️-available-tools)
- [Configuration](#️-configuration)
- [Development](#-development)
- [Contributing](#-contributing)

## 💻 Requirements

- Node.js: Minimum version 18.0.0
  ```bash
  node --version  # Should be >= v18.0.0
  ```
- npm: Minimum version 7.0.0
  ```bash
  npm --version   # Should be >= 7.0.0
  ```
- Operating Systems: 
  - Linux (Ubuntu 20.04+, CentOS 8+)
  - macOS (10.15+)
  - Windows (10+)
- SVGMaker API key ([Get one here](https://svgmaker.io/account))

## 📦 Package Structure

```
@genwave/svgmaker-mcp/
├── build/             # Compiled JavaScript files
├── docs/              # Documentation
│   └── api/           # API documentation
├── src/               # Source TypeScript files
│   ├── tools/         # MCP tool implementations
│   ├── services/      # API integration
│   └── utils/         # Utility functions
└── types/             # TypeScript declarations
```

## 🚀 Installation

```bash
# Using npm
npm install @genwave/svgmaker-mcp

# Using yarn
yarn add @genwave/svgmaker-mcp
```

### Basic Setup

1. Create .env file:
```bash
SVGMAKER_API_KEY="your_api_key_here"
```

2. Start the server:
```bash
npx svgmaker-mcp
```

## 🔌 LLM Integrations

### 🔌 Claude Desktop

1. Add to claude_desktop_config.json:
```json
{
  "mcpServers": {
    "svgmaker": {
      "command": "npx",
      "args": ["@genwave/svgmaker-mcp"],
      "transport": "stdio",
      "env": {
        "SVGMAKER_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

2. Example Claude prompt:
```
Generate an SVG of a minimalist mountain landscape:
<mcp>
{
  "server": "svgmaker",
  "tool": "svgmaker_generate",
  "arguments": {
    "prompt": "Minimalist mountain landscape with sun",
    "output_path": "./landscape.svg",
    "quality": "high",
    "aspectRatio": "landscape"
  }
}
</mcp>
```

### 🔌 Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=svgmaker&config=eyJ0eXBlIjoibG9jYWwiLCJjb21tYW5kIjoibnB4IEBnZW53YXZlL3N2Z21ha2VyLW1jcCIsInRyYW5zcG9ydCI6InN0ZGlvIiwiZW52Ijp7IlNWR01BS0VSX0FQSV9LRVkiOiJ5b3VyX2FwaV9rZXlfaGVyZSJ9fQ%3D%3D)


Or configure manually:

1. Configure in cursor settings:
```json
{
  "mcpServers": {
    "svgmaker": {
      "type": "local",
      "command": "npx",
      "args": ["@genwave/svgmaker-mcp"],
      "transport": "stdio",
      "env": {
        "SVGMAKER_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

2. Example usage in Cursor:
```
Use svgmaker to edit the logo.svg file and make it more modern:
<mcp>
{
  "server": "svgmaker",
  "tool": "svgmaker_edit",
  "arguments": {
    "input_path": "./logo.svg",
    "prompt": "Make it more modern and minimalist",
    "output_path": "./modern_logo.svg",
    "quality": "high"
  }
}
</mcp>
```

### 🔌 Visual Studio Code

[<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20SVGMaker%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect/mcp/install?name=svgmaker&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22apiKey%22%2C%22description%22%3A%22SVGMaker%20API%20Key%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40genwave%2Fsvgmaker-mcp%22%5D%2C%22env%22%3A%7B%22SVGMAKER_API_KEY%22%3A%22%24%7Binput%3AapiKey%7D%22%7D%7D)


Or configure manually:

1. Configure in settings.json:
```json
{
  "servers": {
    "svgmaker": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@genwave/svgmaker-mcp"],
      "env": {
        "SVGMAKER_API_KEY": "<your_api_key>"
      }
    }
  }
}
```

2. Example usage in VS Code:
```
Generate a new icon for my app:
<mcp>
{
  "server": "svgmaker",
  "tool": "svgmaker_generate",
  "arguments": {
    "prompt": "Modern app icon with abstract geometric shapes",
    "output_path": "./assets/icon.svg",
    "quality": "high",
    "aspectRatio": "square"
  }
}
</mcp>
```

### 🔌 WindSurf

1. Configure in settings:
```json
{
  "mcpServers": {
    "svgmaker": {
      "command": "npx",
      "args": ["-y", "@genwave/svgmaker-mcp"],
      "env": {
        "SVGMAKER_API_KEY": "<your_api_key>"
      }
    }
  }
}
```

2. Example usage in WindSurf:
```
Convert the company logo to SVG:
<mcp>
{
  "server": "svgmaker",
  "tool": "svgmaker_convert",
  "arguments": {
    "input_path": "./branding/logo.png",
    "output_path": "./branding/vector_logo.svg"
  }
}
</mcp>
```

### 🔌 Zed

1. Configure in settings:
```json
{
  "context_servers": {
    "svgmaker": {
      "command": {
        "path": "npx",
        "args": ["-y", "@genwave/svgmaker-mcp"],
        "env": {
          "SVGMAKER_API_KEY": "<your_api_key>"
        }
      },
      "settings": {}
    }
  }
}
```

2. Example usage in Zed:
```
Edit an existing SVG file:
<mcp>
{
  "server": "svgmaker",
  "tool": "svgmaker_edit",
  "arguments": {
    "input_path": "./diagrams/flowchart.svg",
    "prompt": "Add rounded corners and smooth gradients",
    "output_path": "./diagrams/enhanced_flowchart.svg",
    "quality": "high"
  }
}
</mcp>
```

## 🛠️ Available Tools

### svgmaker_generate

Generate SVG images from text prompts. Supports style parameters for fine-grained control over the output.

```json
{
  "prompt": "A minimalist mountain landscape with sun",
  "output_path": "/path/to/landscape.svg",
  "quality": "medium",
  "style": "flat",
  "color_mode": "few_colors",
  "composition": "full_scene",
  "background": "transparent"
}
```

**Raster mode** — set `raster: true` to skip vectorization and get a PNG instead of an SVG. Use a `.png` extension for `output_path`. Cannot be combined with `storage` (raster results are temporary).

```json
{
  "prompt": "A minimalist mountain landscape with sun",
  "output_path": "/path/to/landscape.png",
  "quality": "medium",
  "raster": true
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `raster` | boolean | When true, returns a raster PNG instead of SVG (skips vectorization). Use a `.png` output path. Cannot be used with `storage`. |
| `storage` | boolean | When true, stores the generated image permanently in cloud storage. Cannot be used with `raster`. Defaults to true when `raster` is not set. |

#### Style parameters (generate & edit)

All parameters below are optional and shared by `svgmaker_generate` and `svgmaker_edit`. Only specify the ones the user explicitly requests.

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `quality` | `low`, `medium`, `high` | `medium` | Detail level vs. speed. `high` forces a square aspect ratio. |
| `aspectRatio` | `square`, `portrait`, `landscape` | auto (by quality) | Output shape. Ignored when `quality` is `high` (forced square). |
| `background` | `auto`, `transparent`, `opaque` | `auto` | Background style. `transparent` is good for overlays. |
| `style` | `flat`, `line_art`, `engraving`, `linocut`, `silhouette`, `isometric`, `cartoon`, `ghibli` | — | Art style. |
| `color_mode` | `full_color`, `monochrome`, `few_colors` | `full_color` | Color scheme. |
| `image_complexity` | `icon`, `illustration`, `scene` | — | Level of detail in the composition. |
| `composition` | `centered_object`, `repeating_pattern`, `full_scene`, `objects_in_grid` | — | Layout arrangement. |
| `text_style` | `only_title`, `embedded_text` | — | How text is handled in the design. |

### svgmaker_edit

Edit existing SVGs or images with natural language. Supports the same style parameters as generate. Accepts a local file path or generation ID (works for both your own generations and public gallery items).

```json
{
  "input_path": "/path/to/input.svg",
  "prompt": "Add a gradient background and make it more vibrant",
  "output_path": "/path/to/enhanced.svg",
  "quality": "high",
  "style": "cartoon",
  "background": "opaque"
}
```

Or edit directly from a generation ID (works for both generations and gallery items):
```json
{
  "generation_id": "gen_abc123",
  "prompt": "Make the background blue",
  "output_path": "/path/to/edited.svg"
}
```

**Raster mode** — like generate, set `raster: true` to get a PNG instead of an SVG. Use a `.png` extension for `output_path`. Cannot be combined with `storage`.

```json
{
  "input_path": "/path/to/input.svg",
  "prompt": "Make it more vibrant",
  "output_path": "/path/to/edited.png",
  "raster": true
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `raster` | boolean | When true, returns a raster PNG instead of SVG (skips vectorization). Use a `.png` output path. Cannot be used with `storage`. |
| `storage` | boolean | When true, stores the edited image permanently in cloud storage. Cannot be used with `raster`. Defaults to true when `raster` is not set. |

### svgmaker_convert

Convert raster images to SVG using AI-powered vectorization.

```json
{
  "input_path": "/path/to/image.png",
  "output_path": "/path/to/vector.svg"
}
```

### svgmaker_account_info

Get account information including email, display name, account type, and available credits. No parameters required.

```json
{}
```

### svgmaker_account_usage

Get API usage statistics with optional date filtering.

```json
{
  "days": 30
}
```

Or use a date range:
```json
{
  "start": "2026-01-01",
  "end": "2026-01-31"
}
```

### svgmaker_generations_list

List your SVG generations with optional filtering and pagination.

```json
{
  "page": 1,
  "limit": 20,
  "type": "generate",
  "query": "mountain"
}
```

### svgmaker_generations_get

Get detailed information about a specific generation.

```json
{
  "generation_id": "gen_abc123"
}
```

### svgmaker_generations_delete

Delete a generation and its associated files. Requires a paid account.

```json
{
  "generation_id": "gen_abc123"
}
```

### svgmaker_generations_share

Share a generation by making it publicly accessible.

```json
{
  "generation_id": "gen_abc123"
}
```

### svgmaker_generations_download

Download a generation in various formats and save to a local file. Requires a paid account.

```json
{
  "generation_id": "gen_abc123",
  "output_path": "/path/to/output.svg",
  "format": "svg"
}
```

### svgmaker_generations_preview

Preview a generation by returning the image directly in the chat context as a PNG image. The LLM can see and describe the image, enabling follow-up edits.

```json
{
  "generation_id": "gen_abc123"
}
```

### svgmaker_gallery_list

Browse the public SVGMaker gallery with optional filtering and pagination.

```json
{
  "page": 1,
  "limit": 20,
  "type": "generate",
  "query": "landscape",
  "pro": "true"
}
```

### svgmaker_gallery_get

Get detailed information about a specific gallery item.

```json
{
  "generation_id": "gal_abc123"
}
```

### svgmaker_gallery_download

Download a gallery item in various formats and save to a local file. Costs 1 credit for SVG formats, 0 credits for WebP/PNG.

```json
{
  "generation_id": "gal_abc123",
  "output_path": "/path/to/output.svg",
  "format": "svg"
}
```

### svgmaker_gallery_preview

Preview a gallery item by returning the image directly in the chat context as a PNG image.

```json
{
  "generation_id": "gal_abc123"
}
```

### svgmaker_preview

Preview a local image file by returning it directly in the chat context. Supports PNG, SVG, WebP, and SVGZ formats.

```json
{
  "file_path": "/path/to/image.svg"
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SVGMAKER_API_KEY` | Your SVGMaker API key | ✅ Yes | - |
| `SVGMMAKER_RATE_LIMIT_RPM` | API rate limit (requests per minute) | ❌ No | 2 |
| `SVGMAKER_BASE_URL` | Custom SVGMaker API base URL | ❌ No | `https://api.svgmaker.io` |
| `SVGMAKER_DEBUG` | Enable debug logging | ❌ No | `false` |

### Debug Logging

The server includes comprehensive logging for debugging and monitoring:

**Enable Logging:**
```bash
# Enable debug logging
SVGMAKER_DEBUG=true npx @genwave/svgmaker-mcp

# Or set NODE_ENV to development
NODE_ENV=development npx @genwave/svgmaker-mcp
```

**Log Files Location:**
- **macOS/Linux**: `~/.cache/svgmaker-mcp/logs/`
- **Windows**: `%LOCALAPPDATA%/svgmaker-mcp/logs/`
- **Fallback**: `./logs/` (in project directory)

**Log File Format:**
```
mcp-debug-2025-06-04T10-30-45-123Z.log
```

## 🔍 Development

### Local Setup

1. Clone and install dependencies:
```bash
npm install
```

2. Create .env file with your API key
```bash
SVGMAKER_API_KEY="your_api_key_here"
```

3. Run in development mode:
```bash
npm run dev
```

### Testing

Use the MCP Inspector for testing:
```bash
npx @modelcontextprotocol/inspector node build/index.js
```

### CI/CD Workflow

This project uses GitHub Actions for continuous integration and deployment:

1. **Continuous Integration**
   - Runs on every push to main branch and pull requests
   - Performs linting, type checking, and building
   - Ensures code quality and consistency

2. **Bumping the Version**
   - For a patch version (bug fixes):
     ```bash
     npm run version:patch
     ```
   - For a minor version (new features):
     ```bash
     npm run version:minor
     ```
   - For a major version (breaking changes):
     ```bash
     npm run version:major
     ```

3. **Publishing**
   - Automatically publishes to npm when the version bump is merged to `main`

## 🔐 Security

- ✅ Path validation prevents directory traversal
- ✅ Input sanitization for all parameters
- ✅ Secure file operation handling
- ✅ Environment variable protection
- ✅ Rate limiting support

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/GenWaveLLC/svgmaker-mcp/blob/main/CONTRIBUTING.md) for details.

## ⭐ Features

### Input Format Support
- SVG files (.svg)
- PNG images (.png)
- JPEG images (.jpg, .jpeg)
- Other common image formats

### Output Capabilities
- Clean, optimized SVG output
- Multiple aspect ratio options
- Background control (transparent/opaque)
- High-quality vectorization

## 📝 License

MIT © [Genwave AI](https://genwave.xyz) - see the [LICENSE](https://github.com/GenWaveLLC/svgmaker-mcp/blob/main/LICENSE) file for details.
