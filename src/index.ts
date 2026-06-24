#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { initializeSvgmakerService } from './services/svgmakerService.js';
import { logSessionStart, logSessionEnd, logFatalError } from './utils/logUtils.js';
import { createMcpServer } from './server.js';

// Load environment variables
dotenv.config();

async function main() {
  // Log session start
  logSessionStart();

  const apiKey = process.env.SVGMAKER_API_KEY;
  if (!apiKey) {
    process.exit(1);
  }

  // Initialize SVGMaker Service (sets the global singleton used by stdio handlers)
  initializeSvgmakerService(
    apiKey,
    process.env.SVGMMAKER_RATE_LIMIT_RPM,
    process.env.SVGMAKER_BASE_URL || 'https://api.svgmaker.io'
  );

  // Create the MCP server. No client is passed, so handlers use the global singleton.
  const server = createMcpServer();

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logSessionEnd();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logFatalError(error);
  process.exit(1);
});
