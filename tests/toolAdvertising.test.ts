import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../src/server.js';
import { HTTP_OUTPUT_PATH_ERROR } from '../src/utils/outputUtils.js';
import { HTTP_LOCAL_PREVIEW_ERROR } from '../src/utils/previewUtils.js';

const OUTPUT_PATH_TOOLS = [
  'svgmaker_generate',
  'svgmaker_edit',
  'svgmaker_convert',
  'svgmaker_remove_background',
  'svgmaker_generations_download',
  'svgmaker_gallery_download',
];

async function listTools(transport: 'stdio' | 'http'): Promise<Tool[]> {
  const server = createMcpServer(undefined, { transport });
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  await client.close();
  return tools as Tool[];
}

function properties(tools: Tool[], name: string): Record<string, unknown> {
  const tool = tools.find((candidate) => candidate.name === name);
  expect(tool, `${name} is missing from tools/list`).toBeDefined();
  return (tool!.inputSchema.properties ?? {}) as Record<string, unknown>;
}

describe('svgmaker_preview registration', () => {
  it('is absent from tools/list over http', async () => {
    const names = (await listTools('http')).map((tool) => tool.name);
    expect(names).not.toContain('svgmaker_preview');
  });

  it('is present in tools/list over stdio', async () => {
    const names = (await listTools('stdio')).map((tool) => tool.name);
    expect(names).toContain('svgmaker_preview');
  });

  it('keeps the id-based previews on both transports', async () => {
    for (const transport of ['stdio', 'http'] as const) {
      const names = (await listTools(transport)).map((tool) => tool.name);
      expect(names).toContain('svgmaker_generations_preview');
      expect(names).toContain('svgmaker_gallery_preview');
    }
  });
});

describe('output_path in the advertised schema', () => {
  it('is absent over http on every tool that accepts it', async () => {
    const tools = await listTools('http');
    for (const name of OUTPUT_PATH_TOOLS) {
      expect(properties(tools, name), name).not.toHaveProperty('output_path');
    }
  });

  it('is present over stdio on every tool that accepts it', async () => {
    const tools = await listTools('stdio');
    for (const name of OUTPUT_PATH_TOOLS) {
      expect(properties(tools, name), name).toHaveProperty('output_path');
    }
  });

  it('keeps the rest of the schema intact over http', async () => {
    const tools = await listTools('http');
    expect(properties(tools, 'svgmaker_generate')).toHaveProperty('prompt');
    expect(properties(tools, 'svgmaker_generations_download')).toHaveProperty('generation_id');
    expect(properties(tools, 'svgmaker_generations_download')).toHaveProperty('format');
    expect(properties(tools, 'svgmaker_gallery_download')).toHaveProperty('generation_id');
  });
});

describe('advertised descriptions match the transport', () => {
  it('never promises a disk write over http', async () => {
    for (const tool of await listTools('http')) {
      expect(tool.description?.toLowerCase(), tool.name).not.toContain('output_path');
      expect(tool.description?.toLowerCase(), tool.name).not.toContain('saves the file');
      expect(tool.description?.toLowerCase(), tool.name).not.toContain('to a local file');
    }
  });

  it('marks svgmaker_preview as stdio-only', async () => {
    const tools = await listTools('stdio');
    const preview = tools.find((tool) => tool.name === 'svgmaker_preview');
    expect(preview?.description).toContain('stdio');
  });

  // Checking only tool.description missed the local-path wording that lives on the
  // parameters, which is where an agent actually reads what it may pass.
  it('never offers a local path in any parameter description over http', async () => {
    for (const tool of await listTools('http')) {
      const props = (tool.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
      for (const [param, schema] of Object.entries(props)) {
        const text = (schema.description ?? '').toLowerCase();
        const where = `${tool.name}.${param}`;
        expect(text, where).not.toContain('local absolute file path');
        expect(text, where).not.toContain('local file path');
        expect(text, where).not.toContain('absolute path');
        expect(text, where).not.toContain('stdio');
      }
    }
  });

  it('drops the local-path-only aliases over http', async () => {
    for (const name of ['svgmaker_edit', 'svgmaker_convert', 'svgmaker_remove_background']) {
      expect(properties(await listTools('http'), name), name).not.toHaveProperty('input_path');
      expect(properties(await listTools('stdio'), name), name).toHaveProperty('input_path');
    }
  });

  it('points http callers at svgmaker_upload for a local file', async () => {
    for (const name of ['svgmaker_edit', 'svgmaker_convert', 'svgmaker_remove_background']) {
      const input = properties(await listTools('http'), name).input as { description?: string };
      expect(input.description, name).toContain('svgmaker_upload');
    }
  });
});

describe('transport errors name the next step', () => {
  it('points output_path callers at the returned URL', () => {
    expect(HTTP_OUTPUT_PATH_ERROR).toContain('without output_path');
    expect(HTTP_OUTPUT_PATH_ERROR).toContain('URL');
  });

  it('points local preview callers at the id-based previews', () => {
    expect(HTTP_LOCAL_PREVIEW_ERROR).toContain('svgmaker_generations_preview');
    expect(HTTP_LOCAL_PREVIEW_ERROR).toContain('svgmaker_gallery_preview');
    expect(HTTP_LOCAL_PREVIEW_ERROR).toContain('id');
  });
});
