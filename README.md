# SVGMaker MCP Server

An MCP (Model Context Protocol) server that enables LLMs to programmatically generate, edit, and convert SVG images using the SVGMaker API and save them to the local filesystem.

## Features

- **SVG Generation**: Generate SVG images from text prompts with customizable quality and aspect ratio
- **Secure File Operations**: Built-in path validation and security checks
- **Rate Limiting**: Configurable API rate limiting (default: 2 requests per minute)
- **TypeScript**: Full TypeScript support with type safety

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and add your SVGMaker API key:
   ```
   SVGMMAKER_API_KEY="your_actual_api_key_here"
   
   # Optional: Custom base URL and rate limit
   # SVGMMAKER_BASE_URL="https://svgmaker.io/api"
   # SVGMMAKER_RATE_LIMIT_RPM="2"
   ```

## Building

```bash
npm run build
```

## Running

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Configuration

The following environment variables can be configured in your `.env` file:

- `SVGMMAKER_API_KEY` (required): Your SVGMaker API key for authentication
- `SVGMMAKER_RATE_LIMIT_RPM` (optional): Rate limit in requests per minute (default: 2)
- `SVGMMAKER_BASE_URL` (optional): Custom base URL for the SVGMaker API (default: https://svgmaker.io/api)

## Tools Available

### `svgmaker_generate`

Generates an SVG image from a text prompt and saves it to a specified local path.

**Parameters:**
- `prompt` (required): Text description of the SVG to generate
- `output_path` (required): Local file path where the SVG will be saved (must end with .svg)
- `quality` (optional): Quality level - `"low"`, `"medium"`, or `"high"`
  - `low`/`medium`: Uses automatic aspect ratio
  - `high`: Uses square aspect ratio by default
- `aspectRatio` (optional): Override aspect ratio - `"square"`, `"portrait"`, or `"landscape"`

**Example:**
```json
{
  "prompt": "A simple blue circle with a red border",
  "output_path": "./generated_circle.svg",
  "quality": "high",
  "aspectRatio": "square"
}
```

## Testing with MCP Inspector

You can test the server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Claude Desktop Configuration

To use this server with Claude Desktop, add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "svgmaker": {
      "command": "node",
      "args": ["/absolute/path/to/your/svgmaker-mcp-server/build/index.js"],
      "env": {
        "SVGMMAKER_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Security

- Basic path validation prevents access to system directories
- File operations are restricted to safe locations
- All user inputs are validated before processing

## Development Roadmap

- [x] Phase 1: Basic SVG generation tool
- [ ] Phase 2: Add edit and convert tools
- [ ] Phase 3: Enhanced error handling and progress notifications
- [ ] Phase 4: Complete documentation and NPM packaging

## License

MIT