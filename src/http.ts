import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';
import { createSvgmakerClient } from './services/svgmakerService.js';
import { logToFile } from './utils/logUtils.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const DEFAULT_BASE_URL = 'https://api.svgmaker.io';

/**
 * Send a JSON response. Safe no-op if headers were already sent.
 */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Extract the SVGMaker API key from request headers.
 * Prefers `x-svgmaker-api-key`, falls back to `Authorization: Bearer <key>`.
 */
function extractApiKey(req: IncomingMessage): string | undefined {
  const headerKey = req.headers['x-svgmaker-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const auth = req.headers['authorization'];
  if (typeof auth === 'string') {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Read the raw request body and JSON.parse it.
 */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handle a `POST /mcp` request: authenticate, build a per-request client and a
 * fresh stateless MCP server, then delegate to the Streamable HTTP transport.
 */
async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // a. Extract the API key.
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    sendJson(res, 401, { error: 'Missing SVGMaker API key' });
    return;
  }

  // b. Read and parse the request body.
  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body' });
    return;
  }

  // c. Build a per-request client.
  const client = createSvgmakerClient(
    apiKey,
    process.env.SVGMMAKER_RATE_LIMIT_RPM,
    process.env.SVGMAKER_BASE_URL || DEFAULT_BASE_URL
  );

  // d. Build a fresh server.
  const server = createMcpServer(client);

  // e. Create a stateless transport and wire it up.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  // f. Clean up transport + server once the response is done to avoid leaks.
  let cleanedUp = false;
  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    void transport.close();
    void server.close();
  };
  res.on('close', cleanup);
  res.on('finish', cleanup);

  await server.connect(transport);
  await transport.handleRequest(req, res, parsedBody);
}

/**
 * Top-level request router.
 */
async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Strip any query string for routing purposes.
  const url = (req.url || '').split('?')[0];

  if (req.method === 'GET' && url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && url === '/mcp') {
    try {
      await handleMcp(req, res);
    } catch (err) {
      logToFile(`Error handling /mcp request: ${err instanceof Error ? err.stack : String(err)}`);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

createServer((req, res) => {
  void handler(req, res);
}).listen(PORT, () => {
  logToFile(`SVGMaker MCP HTTP server listening on port ${PORT}`);
});
