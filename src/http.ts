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

// The auth server's token endpoint, where a user's MCP token is swapped for an API token.
const TOKEN_ENDPOINT = `${AUTH_SERVER}/api/oauth/token`;

// The header our swap secret goes in; the auth server holds the same secret.
const EXCHANGE_SECRET_HEADER = 'x-token-exchange-secret';
const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';

// Refresh an API token this long before it expires.
const API_TOKEN_MARGIN_MS = 60_000;

// Remote JWKS for verifying RS256 access-token signatures. jose fetches the key
// set from the auth server's well-known endpoint, caches it, and refreshes on a
// `kid` miss, so we don't need our own token/JWKS cache here.
const JWKS = createRemoteJWKSet(new URL(`${AUTH_SERVER}/.well-known/jwks.json`));

// The MCP endpoints. /chatgpt serves the same tools plus ChatGPT's result
// card; /mcp stays plain for every other client (Claude, Cursor, ...).
const MCP_PATHS = ['/mcp', '/chatgpt'];

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
function sendUnauthorized(
  res: ServerResponse,
  req: IncomingMessage,
  path: string,
  message: string
): void {
  if (res.headersSent) return;
  const metadataUrl = `${getResourceUrl(req)}/.well-known/oauth-protected-resource${path}`;
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"`,
  });
  res.end(JSON.stringify({ error: message }));
}

/**
 * Verify an OAuth access token locally against the auth server's JWKS. We require
 * an RS256 JWT signed by svgmaker.io and issued for this server: its `aud` is one
 * of our resource URLs (the root, /mcp or /chatgpt), never the API. `jwtVerify`
 * with these options rejects bad signatures, wrong issuer/audience, expired tokens
 * and anything that isn't a proper JWT. A small clock tolerance absorbs skew. On
 * any failure (including an unreachable JWKS) we treat the token as unauthorized —
 * we never fall back to trusting a token just because it is bearer-shaped.
 *
 * Returns the verified `sub` (Firebase UID) on success, or undefined on failure.
 */
async function verifyAccessToken(token: string, resourceUrl: string): Promise<string | undefined> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_SERVER,
      audience: ['', ...MCP_PATHS].map((path) => `${resourceUrl}${path}`),
      clockTolerance: 30,
    });
    // A verified token must identify a user. Reject (undefined) when `sub` is
    // missing or not a non-empty string instead of letting it through.
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

// API tokens by the MCP token they were swapped for, until they expire.
const apiTokens = new Map<string, { token: string; expiresAt: number }>();

/**
 * Swap a verified MCP token for an API token for the same user at the auth
 * server (OAuth token exchange), reusing one swapped earlier until it nearly
 * expires. The MCP token itself never leaves this server.
 *
 * Returns the API token, or undefined when the swap fails.
 */
async function apiTokenFor(mcpToken: string): Promise<string | undefined> {
  const now = Date.now();
  const cached = apiTokens.get(mcpToken);
  if (cached && cached.expiresAt - API_TOKEN_MARGIN_MS > now) return cached.token;

  const secret = process.env.OAUTH_TOKEN_EXCHANGE_SECRET;
  if (!secret) return undefined;
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        [EXCHANGE_SECRET_HEADER]: secret,
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: mcpToken,
        subject_token_type: ACCESS_TOKEN_TYPE,
      }),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
      return undefined;
    }

    for (const [key, entry] of apiTokens) {
      if (entry.expiresAt <= now) apiTokens.delete(key);
    }
    apiTokens.set(mcpToken, { token: body.access_token, expiresAt: now + body.expires_in * 1000 });
    return body.access_token;
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
 * Handle a `POST` to an MCP endpoint (`path`): authenticate, build a per-request
 * client and a fresh stateless MCP server, then delegate to the Streamable HTTP
 * transport.
 */
async function handleMcp(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  // a. Extract the Bearer access token. A missing token gets the browser-flow 401.
  const token = extractBearerToken(req);
  if (!token) {
    sendUnauthorized(res, req, path, 'Missing OAuth access token');
    return;
  }

  // a2. Verify the JWT locally against the auth server's JWKS before doing any
  //     real work. A failed verification gets the browser-flow 401 too.
  const userId = await verifyAccessToken(token, getResourceUrl(req));
  if (!userId) {
    sendUnauthorized(res, req, path, 'Invalid or expired OAuth access token');
    return;
  }
  logToFile('Authenticated MCP request');

  // a3. Swap it for the API token the tools call api.svgmaker.io with. A failed
  //     swap is our fault, not the user's, so it isn't a 401 (no new sign-in).
  const apiToken = await apiTokenFor(token);
  if (!apiToken) {
    logToFile('Token exchange failed');
    sendJson(res, 502, { error: 'Could not reach SVGMaker sign-in. Try again shortly.' });
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

  // c. Build a per-request client. The API token is sent to api.svgmaker.io as
  //    a Bearer token (the SDK's accessToken mode), not as an x-api-key. apiKey
  //    stays empty here — HTTP transport has no static key.
  const client = createSvgmakerClient(
    '',
    process.env.SVGMAKER_RATE_LIMIT_RPM,
    process.env.SVGMAKER_BASE_URL || DEFAULT_BASE_URL,
    apiToken
  );

  // d. Build a fresh server.
  const server = createMcpServer(client, {
    transport: 'http',
    chatgpt: path === '/chatgpt',
  });

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

  if (req.method === 'POST' && MCP_PATHS.includes(url)) {
    try {
      await handleMcp(req, res, url);
    } catch {
      logToFile('Error handling MCP request');
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // OAuth Protected Resource Metadata (RFC 9728). Clients fetch this to discover
  // which Authorization Server can log the user in, which kicks off the browser
  // flow. We serve it at the root path and at each endpoint's path-suffixed
  // location: some clients (Claude Code) probe the root, others (ChatGPT) follow
  // RFC 9728 and probe `/.well-known/oauth-protected-resource/<endpoint path>`.
  // The `resource` we return matches the path it was asked for.
  const WELL_KNOWN = '/.well-known/oauth-protected-resource';
  if (req.method === 'GET' && url.startsWith(WELL_KNOWN)) {
    const path = url.slice(WELL_KNOWN.length);
    if (path && !MCP_PATHS.includes(path)) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    const base = getResourceUrl(req);
    sendJson(res, 200, {
      resource: `${base}${path}`,
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
  if ((req.method === 'GET' || req.method === 'DELETE') && MCP_PATHS.includes(url)) {
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
