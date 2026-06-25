import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';
import { createSvgmakerClient } from './services/svgmakerService.js';
import { logToFile } from './utils/logUtils.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const DEFAULT_BASE_URL = 'https://api.svgmaker.io';

// Base URL of the OAuth Authorization Server (svgmaker.io) that issues/validates
// tokens. Trailing slash stripped so we can safely append paths.
const AUTH_SERVER = (process.env.SVGMAKER_AUTH_SERVER_URL || 'https://svgmaker.io').replace(/\/+$/, '');

// How long a verified token stays trusted in memory before we re-check it with
// the auth server. Keeps the hot path fast without holding stale tokens too long.
const TOKEN_CACHE_TTL_MS = 60_000;

// In-memory cache mapping an API key (the OAuth access_token) to the epoch-ms
// time at which its "verified" status expires. Only successes are cached.
const tokenCache = new Map<string, number>();

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
 * Work out this server's own public base URL (no trailing slash). Used in the
 * well-known metadata doc and the WWW-Authenticate header so OAuth clients are
 * pointed back at the right place. We prefer an explicit MCP_PUBLIC_URL, but on
 * Cloud Run we can also derive it from the forwarded proto/host headers.
 */
function getResourceUrl(req: IncomingMessage): string {
  const configured = process.env.MCP_PUBLIC_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }

  const fwdProto = req.headers['x-forwarded-proto'];
  const proto = (typeof fwdProto === 'string' && fwdProto.split(',')[0].trim()) || 'http';

  const fwdHost = req.headers['x-forwarded-host'];
  const host =
    (typeof fwdHost === 'string' && fwdHost.split(',')[0].trim()) ||
    req.headers['host'] ||
    `localhost:${PORT}`;

  return `${proto}://${host}`;
}

/**
 * Reply with a 401 that tells an OAuth client where to find our protected-resource
 * metadata. This WWW-Authenticate header is exactly what makes ChatGPT/Claude/Cursor
 * pop open the browser login flow instead of just erroring out.
 */
function sendUnauthorized(res: ServerResponse, req: IncomingMessage, message: string): void {
  if (res.headersSent) return;
  const metadataUrl = `${getResourceUrl(req)}/.well-known/oauth-protected-resource`;
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"`,
  });
  res.end(JSON.stringify({ error: message }));
}

/**
 * Check that an API key (the OAuth access_token) is real and active by asking the
 * auth server. Verified keys are remembered for a short while so we don't hit the
 * auth server on every single request. Failures are never cached.
 */
async function validateToken(apiKey: string): Promise<boolean> {
  // Fast path: recently verified and not yet expired.
  const expiry = tokenCache.get(apiKey);
  if (expiry !== undefined && expiry > Date.now()) {
    return true;
  }

  try {
    const res = await fetch(`${AUTH_SERVER}/api/v1/plugin/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const data = (await res.json()) as { valid?: boolean };
    if (res.ok && data.valid === true) {
      tokenCache.set(apiKey, Date.now() + TOKEN_CACHE_TTL_MS);
      return true;
    }
    return false;
  } catch {
    // Network/parse error: treat as invalid, but don't cache the failure.
    return false;
  }
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
  // a. Extract the API key. A missing key gets the browser-flow 401.
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    sendUnauthorized(res, req, 'Missing SVGMaker API key');
    return;
  }

  // a2. Validate the key with the auth server (covers both browser-issued
  //     tokens and manually-pasted keys) before doing any real work.
  const valid = await validateToken(apiKey);
  if (!valid) {
    sendUnauthorized(res, req, 'Invalid or expired SVGMaker API key');
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

  // OAuth Protected Resource Metadata. OAuth clients fetch this to discover which
  // Authorization Server can log the user in, which kicks off the browser flow.
  if (req.method === 'GET' && url === '/.well-known/oauth-protected-resource') {
    sendJson(res, 200, {
      resource: getResourceUrl(req),
      authorization_servers: [AUTH_SERVER],
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

createServer((req, res) => {
  void handler(req, res);
}).listen(PORT, () => {
  logToFile(`SVGMaker MCP HTTP server listening on port ${PORT}`);
});
