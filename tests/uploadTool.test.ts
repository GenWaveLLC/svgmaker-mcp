import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';

vi.mock('../src/services/svgmakerService.js', () => ({
  prepareUpload: vi.fn(),
}));

import * as svgmakerService from '../src/services/svgmakerService.js';
import { createMcpServer } from '../src/server.js';
import { handleUploadTool } from '../src/tools/uploadTool.js';

async function listToolNames(transport: 'stdio' | 'http'): Promise<string[]> {
  const server = createMcpServer(undefined, { transport });
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  await client.close();
  return tools.map((tool) => tool.name);
}

describe('svgmaker_upload registration', () => {
  it('is absent from tools/list over stdio', async () => {
    expect(await listToolNames('stdio')).not.toContain('svgmaker_upload');
  });

  it('is present in tools/list over http', async () => {
    expect(await listToolNames('http')).toContain('svgmaker_upload');
  });

  it('rejects the call over stdio', async () => {
    const server = createMcpServer(undefined, { transport: 'stdio' });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await expect(
      client.callTool({
        name: 'svgmaker_upload',
        arguments: { filename: 'panda.png' },
      })
    ).rejects.toThrow(/only available over the HTTPS transport/);

    await client.close();
  });
});

function mockPreparedUpload() {
  vi.mocked(svgmakerService.prepareUpload).mockResolvedValue({
    uploadUrl: 'https://api.svgmaker.io/v1/upload/temporary-token',
    expiresIn: 300,
    metadata: {},
  } as any);
}

function callUpload(args: Record<string, unknown>) {
  return handleUploadTool(
    {} as McpServer,
    { params: { name: 'svgmaker_upload', arguments: args } },
    undefined,
    { transport: 'http' }
  );
}

describe('svgmaker_upload handler', () => {
  it('returns the temporary URL, expiry, and multipart curl instruction', async () => {
    mockPreparedUpload();

    const result = await callUpload({ filename: 'panda.png' });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text as string;
    expect(text).toContain('upload_url: https://api.svgmaker.io/v1/upload/temporary-token');
    expect(text).toContain('expires_in: 300');
    expect(text).toContain('curl -X POST -F "file=@<local file>" "<upload_url>"');
    expect(text).toContain('data.upload_id');
    expect(text).toContain('input set to that upload id');
    expect(svgmakerService.prepareUpload).toHaveBeenCalledWith(
      { filename: 'panda.png' },
      undefined
    );
  });

  it('exposes only filename in the input schema', async () => {
    const server = createMcpServer(undefined, { transport: 'http' });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const upload = tools.find((tool) => tool.name === 'svgmaker_upload');
    expect(upload?.inputSchema.properties).toEqual(
      expect.objectContaining({ filename: expect.any(Object) })
    );
    expect(upload?.inputSchema.properties).not.toHaveProperty('size');
    expect(upload?.inputSchema.properties).not.toHaveProperty('content_type');
    await client.close();
  });

  it('advertises the three-step flow with a concrete upload id', async () => {
    const server = createMcpServer(undefined, { transport: 'http' });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const description = tools.find((tool) => tool.name === 'svgmaker_upload')?.description ?? '';
    expect(description).toContain('curl -X POST -F');
    expect(description).toContain('data.upload_id');
    expect(description).toContain('upl_');
    await client.close();
  });

  it('rejects a call with no filename', async () => {
    mockPreparedUpload();

    const result = await callUpload({});

    expect(result.isError).toBe(true);
  });
});
