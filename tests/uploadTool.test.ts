import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';

vi.mock('../src/services/svgmakerService.js', () => ({
  createUploadTicket: vi.fn(),
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
        arguments: { filename: 'panda.png', size: 1 },
      })
    ).rejects.toThrow(/only available over the HTTPS transport/);

    await client.close();
  });
});

function mockTicket(contentType: string) {
  vi.mocked(svgmakerService.createUploadTicket).mockResolvedValue({
    putUrl: 'https://storage.googleapis.com/put?sig=1',
    fileUrl: 'https://storage.googleapis.com/read?sig=2',
    contentType,
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
  it('returns both URLs and the Content-Type instruction', async () => {
    mockTicket('image/png');

    const result = await callUpload({ filename: 'panda.png', size: 482113 });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text as string;
    expect(text).toContain('https://storage.googleapis.com/put?sig=1');
    expect(text).toContain('https://storage.googleapis.com/read?sig=2');
    expect(text).toContain('Content-Type: image/png');
    expect(text).toContain('input');
    expect(svgmakerService.createUploadTicket).toHaveBeenCalledWith(
      { filename: 'panda.png', size: 482113, contentType: undefined },
      undefined
    );
  });

  // The curl instruction has to echo the server's type, not the caller's guess —
  // a mismatch is an opaque GCS SignatureDoesNotMatch.
  it('prints the resolved Content-Type rather than the requested one', async () => {
    mockTicket('image/jpeg');

    const result = await callUpload({ filename: 'panda.jpg', size: 10 });

    expect(result.content[0].text as string).toContain('Content-Type: image/jpeg');
  });

  it('forwards an explicit content_type override', async () => {
    mockTicket('image/png');

    await callUpload({ filename: 'blob', size: 10, content_type: 'image/png' });

    expect(svgmakerService.createUploadTicket).toHaveBeenCalledWith(
      { filename: 'blob', size: 10, contentType: 'image/png' },
      undefined
    );
  });

  it('rejects a call with no filename', async () => {
    mockTicket('image/png');

    const result = await callUpload({ size: 10 });

    expect(result.isError).toBe(true);
  });
});
