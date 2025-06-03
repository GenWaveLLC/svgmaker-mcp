# @genwave/svgmaker-mcp

<div align="center">
  <h3>SVGMaker MCP Server</h3>
  <p>A powerful MCP server for generating, editing, and converting SVG images using AI</p>

  [![npm version](https://img.shields.io/npm/v/@genwave/svgmaker-mcp.svg)](https://www.npmjs.com/package/@genwave/svgmaker-mcp)
  [![License](https://img.shields.io/npm/l/@genwave/svgmaker-mcp.svg)](https://github.com/GenWaveLLC/svgmaker-mcp/blob/main/LICENSE)
  [![Node.js Version](https://img.shields.io/node/v/@genwave/svgmaker-mcp.svg)](https://nodejs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org)
</div>

## 🌟 Highlights

- **🎨 AI-Powered SVG Generation**: Create SVGs from text descriptions
- **✏️ Smart SVG Editing**: Edit existing SVGs with natural language
- **🔄 Image-to-SVG Conversion**: Convert any image to scalable SVG
- **🔒 Secure File Operations**: Built-in path validation and security
- **⚡ Real-Time Progress**: Live updates during operations
- **📝 Type Safety**: Full TypeScript support with type definitions

## 🚀 Quick Start

### Installation

```bash
# npm
npm install @genwave/svgmaker-mcp

# yarn
yarn add @genwave/svgmaker-mcp

# pnpm
pnpm add @genwave/svgmaker-mcp
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

### Claude Desktop

1. Add to claude_desktop_config.json:
```json
{
  "mcpServers": {
    "svgmaker": {
      "command": "node",
      "args": ["/path/to/node_modules/@genwave/svgmaker-mcp/build/index.js"],
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

### Cursor

1. Configure in cursor settings:
```json
{
  "mcpServers": {
    "svgmaker": {
      "type": "local",
      "command": "npx",
      "args": ["@genwave/svgmaker-mcp"]
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

## 🛠️ Available Tools

### svgmaker_generate

Generate SVG images from text descriptions.

```json
{
  "prompt": "A minimalist logo with geometric shapes",
  "output_path": "./logo.svg",
  "quality": "high",
  "aspectRatio": "square",
  "background": "transparent"
}
```

### svgmaker_edit

Edit existing SVGs or images with natural language.

```json
{
  "input_path": "/path/to/input.svg",
  "prompt": "Add a gradient background and make it more vibrant",
  "output_path": "./enhanced.svg",
  "quality": "high",
  "background": "opaque"
}
```

### svgmaker_convert

Convert images to SVG format.

```json
{
  "input_path": "/path/to/image.png",
  "output_path": "./vector.svg"
}
```

## ⚙️ Configuration

Required environment variable in `.env`:

| Variable | Description |
|----------|-------------|
| `SVGMAKER_API_KEY` | Your SVGMaker API key |

## 🔍 Development

### Local Setup

1. Clone the repository:
```bash
git clone https://github.com/GenWaveLLC/svgmaker-mcp.git
cd svgmaker-mcp
```

2. Install dependencies:
```bash
npm install
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

## 🔐 Security

- ✅ Path validation prevents directory traversal
- ✅ Input sanitization for all parameters
- ✅ Secure file operation handling
- ✅ Environment variable protection
- ✅ Rate limiting support

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📚 Documentation

For detailed documentation, please check:
- [API Documentation](docs/api/)
- [GitHub Repository](https://github.com/GenWaveLLC/svgmaker-mcp)
- [Issue Tracker](https://github.com/GenWaveLLC/svgmaker-mcp/issues)

## 📜 License

MIT © [Genwave LLC](https://github.com/GenWaveLLC) - see the [LICENSE](LICENSE) file for details.
