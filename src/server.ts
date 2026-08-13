import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { SVGMakerClient } from '@genwave/svgmaker-sdk';
import { DEFAULT_TOOL_CONTEXT, type ToolContext } from './types/toolContext.js';
import { buildGenerateToolDefinition, handleGenerateTool } from './tools/generateTool.js';
import { buildEditToolDefinition, handleEditTool } from './tools/editTool.js';
import { buildConvertToolDefinition, handleConvertTool } from './tools/convertTool.js';
import {
  buildRemoveBackgroundToolDefinition,
  handleRemoveBackgroundTool,
} from './tools/removeBackgroundTool.js';
import {
  buildAccountInfoToolDefinition,
  handleAccountInfoTool,
  buildAccountUsageToolDefinition,
  handleAccountUsageTool,
} from './tools/accountTool.js';
import {
  buildGenerationsListToolDefinition,
  handleGenerationsListTool,
  buildGenerationsGetToolDefinition,
  handleGenerationsGetTool,
  buildGenerationsDeleteToolDefinition,
  handleGenerationsDeleteTool,
  buildGenerationsShareToolDefinition,
  handleGenerationsShareTool,
  buildGenerationsDownloadToolDefinition,
  handleGenerationsDownloadTool,
  buildGenerationsPreviewToolDefinition,
  handleGenerationsPreviewTool,
} from './tools/generationsTool.js';
import { buildPreviewToolDefinition, handlePreviewTool } from './tools/previewTool.js';
import { buildUploadToolDefinition, handleUploadTool } from './tools/uploadTool.js';
import {
  buildGalleryListToolDefinition,
  handleGalleryListTool,
  buildGalleryGetToolDefinition,
  handleGalleryGetTool,
  buildGalleryDownloadToolDefinition,
  handleGalleryDownloadTool,
  buildGalleryPreviewToolDefinition,
  handleGalleryPreviewTool,
} from './tools/galleryTool.js';

/**
 * Create an MCP server with all SVGMaker tools registered.
 *
 * @param client - Optional per-request SVGMaker client. When omitted, tool
 *   handlers fall back to the global singleton initialized via
 *   `initializeSvgmakerService` (used by the stdio entry point).
 * @param ctx - Transport context passed down to every tool handler.
 */
export function createMcpServer(
  client?: SVGMakerClient,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT
): Server {
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
        // Uploads only exist to get a local file to the cloud; over stdio the tools
        // read local paths directly, so the tool would only ever mislead.
        ...(ctx.transport === 'http' ? [buildUploadToolDefinition(ctx)] : []),
        buildGenerateToolDefinition(ctx),
        buildEditToolDefinition(ctx),
        buildConvertToolDefinition(ctx),
        buildRemoveBackgroundToolDefinition(ctx),
        buildAccountInfoToolDefinition(ctx),
        buildAccountUsageToolDefinition(ctx),
        buildGenerationsListToolDefinition(ctx),
        buildGenerationsGetToolDefinition(ctx),
        buildGenerationsDeleteToolDefinition(ctx),
        buildGenerationsShareToolDefinition(ctx),
        buildGenerationsDownloadToolDefinition(ctx),
        buildGenerationsPreviewToolDefinition(ctx),
        // svgmaker_preview only reads local disk, so over HTTP it can never succeed;
        // svgmaker_generations_preview / svgmaker_gallery_preview cover that transport.
        ...(ctx.transport === 'http' ? [] : [buildPreviewToolDefinition(ctx)]),
        buildGalleryListToolDefinition(ctx),
        buildGalleryGetToolDefinition(ctx),
        buildGalleryDownloadToolDefinition(ctx),
        buildGalleryPreviewToolDefinition(ctx),
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    switch (name) {
      case 'svgmaker_generate':
        return await handleGenerateTool(server, request, client, ctx);
      case 'svgmaker_edit':
        return await handleEditTool(server, request, client, ctx);
      case 'svgmaker_convert':
        return await handleConvertTool(server, request, client, ctx);
      case 'svgmaker_remove_background':
        return await handleRemoveBackgroundTool(server, request, client, ctx);
      case 'svgmaker_account_info':
        return await handleAccountInfoTool(server, request, client, ctx);
      case 'svgmaker_account_usage':
        return await handleAccountUsageTool(server, request, client, ctx);
      case 'svgmaker_generations_list':
        return await handleGenerationsListTool(server, request, client, ctx);
      case 'svgmaker_generations_get':
        return await handleGenerationsGetTool(server, request, client, ctx);
      case 'svgmaker_generations_delete':
        return await handleGenerationsDeleteTool(server, request, client, ctx);
      case 'svgmaker_generations_share':
        return await handleGenerationsShareTool(server, request, client, ctx);
      case 'svgmaker_generations_download':
        return await handleGenerationsDownloadTool(server, request, client, ctx);
      case 'svgmaker_generations_preview':
        return await handleGenerationsPreviewTool(server, request, client, ctx);
      case 'svgmaker_preview':
        return await handlePreviewTool(server, request, client, ctx);
      case 'svgmaker_upload':
        if (ctx.transport !== 'http') {
          throw new Error(
            'svgmaker_upload is only available over the HTTPS transport. Over stdio, pass the local file path directly as `input`.'
          );
        }
        return await handleUploadTool(server, request, client, ctx);
      case 'svgmaker_gallery_list':
        return await handleGalleryListTool(server, request, client, ctx);
      case 'svgmaker_gallery_get':
        return await handleGalleryGetTool(server, request, client, ctx);
      case 'svgmaker_gallery_download':
        return await handleGalleryDownloadTool(server, request, client, ctx);
      case 'svgmaker_gallery_preview':
        return await handleGalleryPreviewTool(server, request, client, ctx);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
