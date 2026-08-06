import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createMcpServer } from './server.js';
import { createSvgmakerClient } from './services/svgmakerService.js';
import { logToFile } from './utils/logUtils.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const DEFAULT_BASE_URL = 'https://api.svgmaker.io';

// Base URL of the OAuth Authorization Server (svgmaker.io) that issues/signs the
// JWT access tokens. This is the expected `iss` claim. Trailing slash stripped so
// we can safely append paths.
const AUTH_SERVER = (process.env.SVGMAKER_AUTH_SERVER_URL || 'https://svgmaker.io').replace(
  /\/+$/,
  ''
);

// Base URL of the protected resource API (api.svgmaker.io) the JWT is minted for.
// This is the expected `aud` claim. Trailing slash stripped for a clean compare.
const API_RESOURCE = (process.env.SVGMAKER_API_RESOURCE || 'https://api.svgmaker.io').replace(
  /\/+$/,
  ''
);

// Remote JWKS for verifying RS256 access-token signatures. jose fetches the key
// set from the auth server's well-known endpoint, caches it, and refreshes on a
// `kid` miss, so we don't need our own token/JWKS cache here.
const JWKS = createRemoteJWKSet(new URL(`${AUTH_SERVER}/.well-known/jwks.json`));

/**
 * Send a JSON response. Safe no-op if headers were already sent.
 */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Extract the OAuth access token from the request. HTTP transport accepts the
 * token ONLY as `Authorization: Bearer <jwt>` — pasted-key headers are no longer
 * supported, since every request must carry a real browser-issued JWT.
 */
function extractBearerToken(req: IncomingMessage): string | undefined {
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
  const metadataUrl = `${getResourceUrl(req)}/.well-known/oauth-protected-resource/mcp`;
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"`,
  });
  res.end(JSON.stringify({ error: message }));
}

/**
 * Verify an OAuth access token locally against the auth server's JWKS. We require
 * an RS256 JWT signed by svgmaker.io with our exact `iss`/`aud`; `jwtVerify` with
 * these options rejects bad signatures, wrong issuer/audience, expired tokens and
 * anything that isn't a proper JWT. A small clock tolerance absorbs skew. On any
 * failure (including an unreachable JWKS) we treat the token as unauthorized — we
 * never fall back to trusting a token just because it is bearer-shaped.
 *
 * Returns the verified `sub` (Firebase UID) on success, or undefined on failure.
 */
async function verifyAccessToken(token: string): Promise<string | undefined> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_SERVER,
      audience: API_RESOURCE,
      clockTolerance: 30,
    });
    // A verified token must identify a user. Reject (undefined) when `sub` is
    // missing or not a non-empty string instead of letting it through.
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : undefined;
  } catch {
    return undefined;
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
  // a. Extract the Bearer access token. A missing token gets the browser-flow 401.
  const token = extractBearerToken(req);
  if (!token) {
    sendUnauthorized(res, req, 'Missing OAuth access token');
    return;
  }

  // a2. Verify the JWT locally against the auth server's JWKS before doing any
  //     real work. A failed verification gets the browser-flow 401 too.
  const userId = await verifyAccessToken(token);
  if (!userId) {
    sendUnauthorized(res, req, 'Invalid or expired OAuth access token');
    return;
  }
  logToFile(`Authenticated /mcp request for user ${userId}`);

  // b. Read and parse the request body.
  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body' });
    return;
  }

  // c. Build a per-request client. The verified JWT is forwarded downstream to
  //    api.svgmaker.io as a Bearer token (the SDK's accessToken mode), not as an
  //    x-api-key. apiKey stays empty here — HTTP transport has no static key.
  const client = createSvgmakerClient(
    '',
    process.env.SVGMAKER_RATE_LIMIT_RPM,
    process.env.SVGMAKER_BASE_URL || DEFAULT_BASE_URL,
    token
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

  // Note: /healthz is reserved by Google Frontend on run.app domains (requests
  // never reach the container), so the health endpoint lives at /health.
  if (req.method === 'GET' && url === '/health') {
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

  // OAuth Protected Resource Metadata (RFC 9728). Clients fetch this to discover
  // which Authorization Server can log the user in, which kicks off the browser
  // flow. We serve it at BOTH the root path and the `/mcp` path-suffixed location:
  // some clients (Claude Code) probe the root, others (ChatGPT) follow RFC 9728
  // and probe `/.well-known/oauth-protected-resource/mcp`. The `resource` we
  // return matches the path so it points at the same MCP endpoint either way.
  if (
    req.method === 'GET' &&
    (url === '/.well-known/oauth-protected-resource' ||
      url === '/.well-known/oauth-protected-resource/mcp')
  ) {
    const base = getResourceUrl(req);
    sendJson(res, 200, {
      resource: url.endsWith('/mcp') ? `${base}/mcp` : base,
      authorization_servers: [AUTH_SERVER],
    });
    return;
  }

  // The Streamable HTTP transport here is stateless (no session, no
  // server-initiated stream), so we don't offer an SSE stream at GET /mcp nor
  // session teardown at DELETE /mcp. Per the MCP spec a server that doesn't
  // support these MUST answer 405 (not 404): clients like Cursor open a GET SSE
  // stream after connecting, and a 404 makes them treat the session as dead and
  // tombstone the transport, whereas a 405 tells them to skip the optional
  // stream and continue over POST.
  if ((req.method === 'GET' || req.method === 'DELETE') && url === '/mcp') {
    res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

createServer((req, res) => {
  void handler(req, res);
}).listen(PORT, () => {
  logToFile(`SVGMaker MCP HTTP server listening on port ${PORT}`);
});
