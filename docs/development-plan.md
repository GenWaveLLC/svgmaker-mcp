## Project: SVGMaker MCP Server

**Core Use Case:** Enable LLMs to programmatically generate, edit, and convert SVG images using the SVGMaker API and save them to the local filesystem. This is for "vibe coders," designers, and game developers using AI to automate asset creation.

**Caller & IO:**
*   **Caller:** LLMs (via MCP Client).
*   **Input:**
    *   `generate`: Text prompt, output path, optional styling parameters.
    *   `edit`: Input image path (raster/vector), text prompt, output path, optional styling parameters.
    *   `convert`: Input image path (raster), output path.
*   **Output:**
    *   For all tools: A success/failure message. If successful, includes the absolute path to the created/modified file.
    *   The actual SVG/image is saved to the specified `output_path` on the local filesystem.

**Performance/Throughput:**
*   Configurable rate limit via an environment variable (e.g., `SVGMMAKER_RATE_LIMIT_RPM`), defaulting to 2 requests per minute. The `svgmaker-sdk` will handle the actual rate limiting if configured.

**Deployment:**
*   Local STDIO MCP server.

**Preferred Language/Tech Stack:**
*   TypeScript, Node.js.
*   `@modelcontextprotocol/sdk` for MCP server implementation.
*   `svgmaker-sdk` for interacting with the SVGMaker API.
*   `zod` for input schema validation.
*   `dotenv` for environment variable management.

---

### Development Plan

#### Phase 1: Project Setup & Basic `generate` Tool

1.  **Initialize Project:**
    *   Create `svgmaker-mcp-server` directory.
    *   `npm init -y`
    *   Install dependencies: `npm install @modelcontextprotocol/sdk svgmaker-sdk zod dotenv`
    *   Install dev dependencies: `npm install -D typescript @types/node ts-node-dev rimraf`
    *   Setup `tsconfig.json` for TypeScript compilation.
    *   Add build/start scripts to `package.json`.

2.  **Directory Structure:**

    ```
    svgmaker-mcp-server/
    ├── src/
    │   ├── index.ts               # Main server entry point, MCP setup
    │   ├── services/
    │   │   └── svgmakerService.ts # Wrapper for SVGMaker SDK client & logic
    │   ├── tools/
    │   │   ├── generateTool.ts    # Definition and handler for the generate tool
    │   │   ├── editTool.ts        # (Phase 2)
    │   │   └── convertTool.ts     # (Phase 2)
    │   └── utils/
    │       └── fileUtils.ts       # Filesystem operations, path validation
    ├── .env.example               # Example environment variables
    ├── .env                       # Local environment variables (ignored by git)
    ├── package.json
    ├── tsconfig.json
    └── .gitignore
    ```

3.  **Environment Variables (`.env`):**

    ```env
    SVGMMAKER_API_KEY="your_svgmaker_api_key_here"
    SVGMMAKER_RATE_LIMIT_RPM="2" # Requests per minute
    # Optional: Define default allowed roots if client doesn't provide them
    # DEFAULT_ALLOWED_ROOTS="/Users/youruser/Desktop,/Users/youruser/Projects/SVGs"
    ```

4.  **`src/services/svgmakerService.ts` (Initial):**
    *   Initialize `SVGMakerClient` using API key and rate limit from `.env`.
    *   Implement `generateSVG` function:
        *   Takes prompt and SVGMaker SDK options.
        *   Calls `client.generate.configure(...).execute()`.
        *   Requests `svgText: true`.
        *   Returns the result (or throws an error).

5.  **`src/utils/fileUtils.ts` (Initial):**
    *   Implement `writeFile(filePath: string, content: string): Promise<void>`.
    *   Implement `resolveAndValidatePath(rawPath: string, allowedRoots: string[], accessType: 'read' | 'write'): Promise<string>`. This is crucial for security. It should:
        *   Resolve `rawPath` to an absolute path.
        *   Check if the absolute path is within any of the `allowedRoots`.
        *   For 'write', ensure the parent directory exists and is within roots.
        *   Throw an error if validation fails.

6.  **`src/tools/generateTool.ts`:**
    *   Define Zod schema for input: `prompt` (string), `output_path` (string), optional `quality`, `aspectRatio`, `style`, `color_mode` etc.
    *   Implement the tool handler:
        *   Get `allowedRoots` (from `server.getRoots()` - this means the client, like Claude Desktop, must provide them).
        *   Validate `output_path` using `fileUtils.resolveAndValidatePath`.
        *   Call `svgmakerService.generateSVG`.
        *   Write `result.svgText` to validated `output_path` using `fileUtils.writeFile`.
        *   Return `TextContent` with success/failure message and path.

7.  **`src/index.ts` (Main Server):**
    *   Load `.env` using `dotenv`.
    *   Initialize `McpServer` from `@modelcontextprotocol/sdk`.
        *   Name: "svgmaker-server", Version: "0.1.0".
        *   Capabilities: `tools: { listChanged: false }`, `roots: {}` (to signal it can use roots from client).
    *   Import and register `generateTool` using `server.tool()`.
    *   Connect `StdioServerTransport`.
    *   Basic error logging.

8.  **Testing:**
    *   Use MCP Inspector: `npx @modelcontextprotocol/inspector node build/index.js`
    *   Call the `generate` tool with valid and invalid paths.

#### Phase 2: Implement `edit` and `convert` Tools

1.  **Extend `src/services/svgmakerService.ts`:**
    *   Implement `editSVG` function (takes input image path/buffer, prompt, options). It will need to read the input file.
    *   Implement `convertImageToSVG` function (takes input image path/buffer, options). It will also need to read the input file.

2.  **`src/tools/editTool.ts`:**
    *   Define Zod schema: `input_image_path`, `prompt`, `output_path`, optional styling.
    *   Handler:
        *   Validate `input_image_path` (read access) and `output_path` (write access) using `fileUtils`.
        *   Read `input_image_path` content into a Buffer.
        *   Call `svgmakerService.editSVG`.
        *   Write result to `output_path`.
        *   Return `TextContent`.

3.  **`src/tools/convertTool.ts`:**
    *   Define Zod schema: `input_image_path`, `output_path`.
    *   Handler:
        *   Validate paths.
        *   Read `input_image_path` content.
        *   Call `svgmakerService.convertImageToSVG`.
        *   Write result to `output_path`.
        *   Return `TextContent`.

4.  **Update `src/index.ts`:**
    *   Register `editTool` and `convertTool`.

5.  **Testing:**
    *   Use MCP Inspector for `edit` and `convert` tools.

#### Phase 3: Refinements & Claude Desktop Integration

1.  **Error Handling:**
    *   Ensure all tool handlers have robust try/catch blocks.
    *   Return `isError: true` and informative `TextContent` for MCP errors.
    *   Log detailed errors to `stderr` for debugging.

2.  **Progress Notifications (Optional but good UX):**
    *   If SVGMaker SDK calls are long, and if the SDK provides progress (e.g., via its streaming), the MCP server can send `notifications/progress` to the client.
    *   This would involve passing a `progressToken` from the client's `tools/call` request (if provided in `_meta`) and using it in server notifications. For STDIO, this is less critical but good to keep in mind.

3.  **Claude Desktop Configuration (`claude_desktop_config.json`):**
    *   Configure Claude Desktop to run this server.
        ```json
        {
          "mcpServers": {
            "svgmaker": {
              "command": "node",
              "args": [
                "/absolute/path/to/your/svgmaker-mcp-server/build/index.js"
              ],
              "env": { // Optional: if you don't want to rely solely on .env in server dir
                "SVGMMAKER_API_KEY": "your_key_here_if_not_in_server_env"
              }
              // Roots will be implicitly passed by Claude Desktop
              // if both client & server declare 'roots' capability.
            }
          }
        }
        ```
    *   Test interaction with Claude Desktop, ensuring paths provided by Claude are correctly handled and validated against the roots Claude Desktop is aware of (e.g., your project directory).

#### Phase 4: Documentation & Packaging

1.  **README.md:**
    *   Instructions for setup, configuration (API key, roots), and running.
    *   Details about the tools provided, their inputs, and outputs.
    *   Example `claude_desktop_config.json` snippet.
2.  **NPM Package (Optional):**
    *   If intended for broader distribution, publish to NPM.
    *   Update `package.json` with `bin` scripts, `files` to include `build` directory.

---

### Code Snippets (Illustrative)

**`src/index.ts` (Partial):**
```typescript
import { McpServer, ServerCapabilities } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import dotenv from 'dotenv';
import { initializeSvgmakerService } from './services/svgmakerService';
import { registerGenerateTool } from './tools/generateTool';
import { registerEditTool } from './tools/editTool';
import { registerConvertTool } from './tools/convertTool';
import { Root } from '@modelcontextprotocol/sdk/types'; // For getRoots

dotenv.config();

async function main() {
    const apiKey = process.env.SVGMMAKER_API_KEY;
    if (!apiKey) {
        console.error("SVGMMAKER_API_KEY environment variable is not set.");
        process.exit(1);
    }

    const server = new McpServer({
        name: "svgmaker-server",
        version: "0.1.0",
        capabilities: {
            tools: { listChanged: false }, // No dynamic tool changes for now
            // Declare roots capability so client (e.g. Claude Desktop) can send its roots
            // And server can call server.getRoots()
            roots: {}, 
        } as ServerCapabilities, // Cast to bypass strictPartialInitialization
    });

    // Initialize SVGMaker Service (which initializes the SDK client)
    initializeSvgmakerService(apiKey, process.env.SVGMMAKER_RATE_LIMIT_RPM);

    // Register tools
    registerGenerateTool(server);
    registerEditTool(server); // You'll create these
    registerConvertTool(server); // You'll create these

    // Function to get validated roots.
    // Roots are typically provided by the client (e.g., Claude Desktop).
    // This server can access them via server.getRoots().
    // For standalone testing or if client doesn't provide roots,
    // you might fall back to DEFAULT_ALLOWED_ROOTS from .env.
    server.onInitialize(async (params) => {
        console.error(`Client connected: ${params.clientInfo?.name} v${params.clientInfo?.version}`);
        // Client capabilities are in params.capabilities
        // Server capabilities are returned in the result of onInitialize (done by McpServer class)
        
        // Example: Log the roots provided by the client (if any)
        // Note: getRoots() might only be populated *after* initialize completes
        // and client sends `roots/listChanged` or server requests `roots/list`.
        // For STDIO, Claude Desktop typically sends roots as part of its initial setup.
    });
    
    server.onRequest(async (request) => {
        // This is a good place to log incoming requests for debugging
        console.error(`Received MCP request: ${request.method}`);
        if (request.method === 'roots/list') { // Example: server requesting roots
            const clientRoots = server.getRoots(); // Assuming client has provided them
             if (clientRoots && clientRoots.length > 0) {
                return { roots: clientRoots.map(r => ({uri: r.uri, name: r.name})) };
            }
            // Fallback or error if no roots
            return { roots: [] };
        }
    });


    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("SVGMaker MCP Server running on stdio.");

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.error("Shutting down SVGMaker MCP Server...");
        await server.close();
        process.exit(0);
    });
}

main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
```

**`src/services/svgmakerService.ts` (Partial):**
```typescript
import { SVGMakerClient, Types as SVGMakerTypes } from 'svgmaker-sdk';
import fs from 'fs/promises';

let svgMaker: SVGMakerClient;

export function initializeSvgmakerService(apiKey: string, rateLimitRpmStr?: string) {
    const rateLimit = rateLimitRpmStr ? parseInt(rateLimitRpmStr, 10) : 2;
    svgMaker = new SVGMakerClient(apiKey, {
        logging: true, // Or configure as needed
        logLevel: 'info',
        rateLimit: rateLimit, // RPM
    });
    console.error(`SVGMaker SDK initialized with rate limit: ${rateLimit} RPM`);
}

export async function generateSVG(params: SVGMakerTypes.GenerateParams): Promise<SVGMakerTypes.GenerateResponse> {
    if (!svgMaker) throw new Error("SVGMakerService not initialized.");
    try {
        // Ensure svgText is true to get the content
        const configuredParams = { ...params, svgText: true };
        const result = await svgMaker.generate.configure(configuredParams).execute();
        return result;
    } catch (error) {
        console.error("Error in generateSVG:", error);
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
        console.error("Error in editSVG:", error);
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
        console.error("Error in convertImageToSVG:", error);
        throw error;
    }
}
```

**`src/utils/fileUtils.ts` (Conceptual):**
```typescript
import fs from 'fs/promises';
import path from 'path';
import { Root } from '@modelcontextprotocol/sdk/types'; // For Root type

// Helper to check if a child path is within a parent root URI
function isPathWithinRoot(filePath: string, rootUri: string): boolean {
    const rootPath = new URL(rootUri).pathname;
    const relative = path.relative(rootPath, filePath);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function resolveAndValidatePath(
    rawPath: string,
    clientRoots: Root[], // Roots from server.getRoots()
    accessType: 'read' | 'write'
): Promise<string> {
    const absolutePath = path.resolve(rawPath);

    // Use client-provided roots if available
    const rootsToUse = clientRoots.length > 0 
        ? clientRoots.map(r => r.uri) 
        : (process.env.DEFAULT_ALLOWED_ROOTS?.split(',') || []);

    if (rootsToUse.length === 0) {
        throw new Error("No allowed filesystem roots are defined. Configure client or DEFAULT_ALLOWED_ROOTS env var.");
    }

    const isValidPath = rootsToUse.some(rootUri => isPathWithinRoot(absolutePath, rootUri));

    if (!isValidPath) {
        throw new Error(`Access to path "${absolutePath}" is denied. It's not within allowed roots: ${rootsToUse.join(', ')}`);
    }

    if (accessType === 'write') {
        const dir = path.dirname(absolutePath);
        try {
            await fs.access(dir, fs.constants.W_OK);
        } catch (err) {
            throw new Error(`Directory "${dir}" is not writable or does not exist.`);
        }
    } else if (accessType === 'read') {
        try {
            await fs.access(absolutePath, fs.constants.R_OK);
        } catch (err) {
            throw new Error(`File "${absolutePath}" is not readable or does not exist.`);
        }
    }
    return absolutePath;
}

export async function writeFile(filePath: string, content: string): Promise<void> {
    try {
        await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        throw new Error(`Failed to write file: ${filePath}`);
    }
}

export async function readFileToBuffer(filePath: string): Promise<Buffer> {
    try {
        return await fs.readFile(filePath);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw new Error(`Failed to read file: ${filePath}`);
    }
}
```

**`src/tools/generateTool.ts` (Conceptual - showing Zod and handler):**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server';
import { TextContent } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';
import * as svgmakerService from '../services/svgmakerService';
import * as fileUtils from '../utils/fileUtils';

const GenerateToolInputSchema = z.object({
    prompt: z.string().min(1, "Prompt cannot be empty."),
    output_path: z.string().min(1, "Output path cannot be empty."),
    quality: z.enum(['low', 'medium', 'high']).optional(),
    aspectRatio: z.enum(['auto', 'portrait', 'landscape', 'square', 'wide', 'tall']).optional(),
    // Add other SVGMaker SDK styleParams as optional zod types here
    // style: z.enum([...]).optional(),
    // color_mode: z.enum([...]).optional(),
});

export function registerGenerateTool(server: McpServer) {
    server.tool(
        "svgmaker_generate",
        "Generates an SVG image from a text prompt using SVGMaker API and saves it to a specified local path.",
        GenerateToolInputSchema,
        async (args, context) => { // context contains McpServerExchange
            try {
                const clientRoots = server.getRoots(); // MCP Server instance can provide this
                const validatedOutputPath = await fileUtils.resolveAndValidatePath(args.output_path, clientRoots, 'write');

                const sdkParams = {
                    prompt: args.prompt,
                    quality: args.quality,
                    aspectRatio: args.aspectRatio,
                    // Map other args.style, args.color_mode etc. to sdkParams.styleParams
                    svgText: true,
                };

                const result = await svgmakerService.generateSVG(sdkParams as any); // Cast if complex

                if (result.svgText) {
                    await fileUtils.writeFile(validatedOutputPath, result.svgText);
                    return {
                        content: [{ type: 'text', text: `SVG generated successfully: ${validatedOutputPath}` } as TextContent]
                    };
                } else {
                    throw new Error("SVGMaker API did not return SVG content.");
                }
            } catch (error: any) {
                console.error("Error in svgmaker_generate tool:", error);
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error generating SVG: ${error.message}` } as TextContent]
                };
            }
        }
    );
}
```