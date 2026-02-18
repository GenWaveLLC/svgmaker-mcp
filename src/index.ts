#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { initializeSvgmakerService } from './services/svgmakerService.js';
import { logSessionStart, logSessionEnd, logFatalError } from './utils/logUtils.js';
import { generateToolDefinition, handleGenerateTool } from './tools/generateTool.js';
import { editToolDefinition, handleEditTool } from './tools/editTool.js';
import { convertToolDefinition, handleConvertTool } from './tools/convertTool.js';

// Load environment variables
dotenv.config();

async function main() {
  // Log session start
  logSessionStart();

  const apiKey = process.env.SVGMAKER_API_KEY;
  if (!apiKey) {
    process.exit(1);
  }

  // Initialize the MCP server
  const server = new Server(
    {
      name: 'svgmaker-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize SVGMaker Service
  initializeSvgmakerService(
    apiKey,
    process.env.SVGMMAKER_RATE_LIMIT_RPM,
    process.env.SVGMAKER_BASE_URL || 'https://api.svgmaker.io'
  );

  // Set up unified tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [generateToolDefinition, editToolDefinition, convertToolDefinition],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    switch (name) {
      case 'svgmaker_generate':
        return await handleGenerateTool(server, request);
      case 'svgmaker_edit':
        return await handleEditTool(server, request);
      case 'svgmaker_ai_vectorize':
        return await handleConvertTool(server, request);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

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
