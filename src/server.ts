import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import { generateToolDefinition, handleGenerateTool } from './tools/generateTool.js';
import { editToolDefinition, handleEditTool } from './tools/editTool.js';
import { convertToolDefinition, handleConvertTool } from './tools/convertTool.js';
import {
  accountInfoToolDefinition,
  handleAccountInfoTool,
  accountUsageToolDefinition,
  handleAccountUsageTool,
} from './tools/accountTool.js';
import {
  generationsListToolDefinition,
  handleGenerationsListTool,
  generationsGetToolDefinition,
  handleGenerationsGetTool,
  generationsDeleteToolDefinition,
  handleGenerationsDeleteTool,
  generationsShareToolDefinition,
  handleGenerationsShareTool,
  generationsDownloadToolDefinition,
  handleGenerationsDownloadTool,
  generationsPreviewToolDefinition,
  handleGenerationsPreviewTool,
} from './tools/generationsTool.js';
import { previewToolDefinition, handlePreviewTool } from './tools/previewTool.js';
import {
  galleryListToolDefinition,
  handleGalleryListTool,
  galleryGetToolDefinition,
  handleGalleryGetTool,
  galleryDownloadToolDefinition,
  handleGalleryDownloadTool,
  galleryPreviewToolDefinition,
  handleGalleryPreviewTool,
} from './tools/galleryTool.js';

/**
 * Create an MCP server with all SVGMaker tools registered.
 *
 * @param client - Optional per-request SVGMaker client. When omitted, tool
 *   handlers fall back to the global singleton initialized via
 *   `initializeSvgmakerService` (used by the stdio entry point).
 */
export function createMcpServer(client?: SVGMakerClient): Server {
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

  // Set up unified tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        generateToolDefinition,
        editToolDefinition,
        convertToolDefinition,
        accountInfoToolDefinition,
        accountUsageToolDefinition,
        generationsListToolDefinition,
        generationsGetToolDefinition,
        generationsDeleteToolDefinition,
        generationsShareToolDefinition,
        generationsDownloadToolDefinition,
        generationsPreviewToolDefinition,
        previewToolDefinition,
        galleryListToolDefinition,
        galleryGetToolDefinition,
        galleryDownloadToolDefinition,
        galleryPreviewToolDefinition,
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    switch (name) {
      case 'svgmaker_generate':
        return await handleGenerateTool(server, request, client);
      case 'svgmaker_edit':
        return await handleEditTool(server, request, client);
      case 'svgmaker_convert':
        return await handleConvertTool(server, request, client);
      case 'svgmaker_account_info':
        return await handleAccountInfoTool(server, request, client);
      case 'svgmaker_account_usage':
        return await handleAccountUsageTool(server, request, client);
      case 'svgmaker_generations_list':
        return await handleGenerationsListTool(server, request, client);
      case 'svgmaker_generations_get':
        return await handleGenerationsGetTool(server, request, client);
      case 'svgmaker_generations_delete':
        return await handleGenerationsDeleteTool(server, request, client);
      case 'svgmaker_generations_share':
        return await handleGenerationsShareTool(server, request, client);
      case 'svgmaker_generations_download':
        return await handleGenerationsDownloadTool(server, request, client);
      case 'svgmaker_generations_preview':
        return await handleGenerationsPreviewTool(server, request, client);
      case 'svgmaker_preview':
        return await handlePreviewTool(server, request, client);
      case 'svgmaker_gallery_list':
        return await handleGalleryListTool(server, request, client);
      case 'svgmaker_gallery_get':
        return await handleGalleryGetTool(server, request, client);
      case 'svgmaker_gallery_download':
        return await handleGalleryDownloadTool(server, request, client);
      case 'svgmaker_gallery_preview':
        return await handleGalleryPreviewTool(server, request, client);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
