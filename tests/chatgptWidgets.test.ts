import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../src/server.js';
import {
  buildErrorResult,
  buildFileResult,
  buildListResult,
  withImageCard,
} from '../src/utils/outputUtils.js';
import { fetchCardPreview } from '../src/utils/previewUtils.js';
import * as svgmakerService from '../src/services/svgmakerService.js';

vi.mock('../src/services/svgmakerService.js', () => ({
  generateSVG: vi.fn(),
  editSVG: vi.fn(),
  convertImageToSVG: vi.fn(),
  removeBackground: vi.fn(),
  getAccountInfo: vi.fn(),
  getGeneration: vi.fn(),
  downloadGeneration: vi.fn(),
}));

vi.mock('../src/utils/previewUtils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/previewUtils.js')>()),
  fetchCardPreview: vi.fn().mockResolvedValue('data:image/webp;base64,UFJFVklFVw=='),
}));

const RESULT_CARD_TOOLS = [
  'svgmaker_generate',
  'svgmaker_edit',
  'svgmaker_convert',
  'svgmaker_remove_background',
  'svgmaker_generations_get',
  'svgmaker_generations_preview',
  'svgmaker_gallery_preview',
];

const CHATGPT = { transport: 'http', chatgpt: true } as const;

async function connect(ctx: 'stdio' | 'http' | typeof CHATGPT): Promise<Client> {
  const server = createMcpServer(undefined, typeof ctx === 'string' ? { transport: ctx } : ctx);
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('safety hints', () => {
  it('sets all three hints as booleans on every tool, on both transports', async () => {
    for (const transport of ['stdio', 'http'] as const) {
      const client = await connect(transport);
      const { tools } = await client.listTools();
      for (const tool of tools as Tool[]) {
        const hints = tool.annotations ?? {};
        expect(typeof hints.readOnlyHint, `${transport} ${tool.name}`).toBe('boolean');
        expect(typeof hints.destructiveHint, `${transport} ${tool.name}`).toBe('boolean');
        expect(typeof hints.openWorldHint, `${transport} ${tool.name}`).toBe('boolean');
      }
      await client.close();
    }
  });

  it('marks only deletion and public sharing as destructive over HTTP', async () => {
    const client = await connect('http');
    const { tools } = await client.listTools();
    const destructive = tools.filter((tool) => tool.annotations?.destructiveHint);
    expect(destructive.map((tool) => tool.name).sort()).toEqual([
      'svgmaker_generations_delete',
      'svgmaker_generations_share',
    ]);
    await client.close();
  });

  it('also marks the credit-spending tools as destructive on the ChatGPT endpoint', async () => {
    const client = await connect(CHATGPT);
    const { tools } = await client.listTools();
    const destructive = tools.filter((tool) => tool.annotations?.destructiveHint);
    expect(destructive.map((tool) => tool.name).sort()).toEqual([
      'svgmaker_convert',
      'svgmaker_edit',
      'svgmaker_generate',
      'svgmaker_generations_delete',
      'svgmaker_generations_share',
      'svgmaker_remove_background',
    ]);
    await client.close();
  });
});

describe('local file overwrites', () => {
  it('marks every tool that accepts output_path as destructive over stdio', async () => {
    const client = await connect('stdio');
    try {
      const { tools } = await client.listTools();
      const writers = tools.filter((tool) => tool.inputSchema.properties?.output_path);
      expect(writers).toHaveLength(6);
      for (const tool of writers) {
        expect(tool.annotations?.destructiveHint, tool.name).toBe(true);
        expect(tool.annotations?.readOnlyHint, tool.name).toBe(false);
      }
    } finally {
      await client.close();
    }
  });
});

describe('result card widget', () => {
  it('links the file-making tools to a registered widget on the ChatGPT endpoint', async () => {
    const client = await connect(CHATGPT);
    const { tools } = await client.listTools();
    const { resources } = await client.listResources();
    for (const name of RESULT_CARD_TOOLS) {
      const tool = tools.find((candidate) => candidate.name === name);
      const uri = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
      expect(uri, name).toBeDefined();
      expect(resources.map((resource) => resource.uri)).toContain(uri);
    }
    await client.close();
  });

  it('serves the widget HTML with the MCP Apps MIME type and a CSP', async () => {
    const client = await connect(CHATGPT);
    const { resources } = await client.listResources();
    const { contents } = await client.readResource({ uri: resources[0].uri });
    const content = contents[0] as { mimeType?: string; text?: string; _meta?: any };
    expect(content.mimeType).toBe('text/html;profile=mcp-app');
    expect(content.text).toContain('<html');
    expect(content._meta.ui.csp.resourceDomains.length).toBeGreaterThan(0);
    expect(content._meta.ui.domain).toBe('https://mcp.svgmaker.io');
    await client.close();
  });

  it.each([
    ['svgmaker_generate', { prompt: 'a panda' }, 'generateSVG'],
    ['svgmaker_generate', { prompt: 'a panda', raster: true }, 'generateSVG'],
    ['svgmaker_edit', { prompt: 'make it blue', generation_id: 'gen1' }, 'editSVG'],
    ['svgmaker_edit', { prompt: 'make it blue', generation_id: 'gen1', raster: true }, 'editSVG'],
    ['svgmaker_convert', { input: 'https://svgmaker.io/input.png' }, 'convertImageToSVG'],
    ['svgmaker_remove_background', { generation_id: 'gen1' }, 'removeBackground'],
  ] as const)(
    'validates %s results against the advertised HTTP output schema (%j)',
    async (name, args, service) => {
      vi.mocked(svgmakerService[service]).mockResolvedValue({
        svgUrl: 'https://svgmaker.io/result.svg',
        imageUrl: 'https://svgmaker.io/result.png',
        generationId: 'gen2',
        creditCost: 2,
      } as any);
      vi.mocked(svgmakerService.getAccountInfo).mockResolvedValue({
        credits: 5,
        premiumCredits: 35,
      } as any);
      const client = await connect(CHATGPT);
      try {
        const { tools } = await client.listTools();
        expect(tools.find((tool) => tool.name === name)?.outputSchema).toBeDefined();
        // The MCP client validates successful results against the tool's outputSchema.
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError).not.toBe(true);
        expect(result.structuredContent).toMatchObject({ generationId: 'gen2' });
        expect(result._meta?.['svgmaker/file']).toMatchObject({
          creditsUsed: 2,
          premiumCredits: 35,
          credits: 5,
        });
        expect(result.structuredContent?.format).toBe(
          'raster' in args && args.raster ? 'png' : 'svg'
        );
      } finally {
        await client.close();
      }
    }
  );

  it('answers an old result card URI with the current card', async () => {
    const client = await connect(CHATGPT);
    const { resources } = await client.listResources();
    const current = await client.readResource({ uri: resources[0].uri });
    const old = await client.readResource({ uri: 'ui://svgmaker/result-card-v7.html' });
    expect(old.contents[0].uri).toBe('ui://svgmaker/result-card-v7.html');
    expect((old.contents[0] as { text?: string }).text).toBe(
      (current.contents[0] as { text?: string }).text
    );
    await expect(client.readResource({ uri: 'ui://svgmaker/other.html' })).rejects.toThrow();
    await client.close();
  });

  it('answers an old list card URI with the current card', async () => {
    const client = await connect(CHATGPT);
    const { resources } = await client.listResources();
    const current = await client.readResource({ uri: resources[1].uri });
    const old = await client.readResource({ uri: 'ui://svgmaker/list-card-v1.html' });
    expect(old.contents[0].uri).toBe('ui://svgmaker/list-card-v1.html');
    expect((old.contents[0] as { text?: string }).text).toBe(
      (current.contents[0] as { text?: string }).text
    );
    await client.close();
  });

  it('adds no widget links or resources over stdio', async () => {
    const client = await connect('stdio');
    const { tools } = await client.listTools();
    expect(tools.some((tool) => tool._meta)).toBe(false);
    expect(tools.some((tool) => tool.outputSchema)).toBe(false);
    expect(client.getServerCapabilities()?.resources).toBeUndefined();
    await client.close();
  });

  it('adds no widget links or resources on the plain HTTP endpoint', async () => {
    const client = await connect('http');
    const { tools } = await client.listTools();
    expect(tools.some((tool) => tool._meta)).toBe(false);
    expect(client.getServerCapabilities()?.resources).toBeUndefined();
    await client.close();
  });
});

describe('downloads', () => {
  const DOWNLOAD_TOOLS = ['svgmaker_generations_download', 'svgmaker_gallery_download'];

  it('leaves the download tools out on the ChatGPT endpoint only', async () => {
    for (const ctx of ['stdio', 'http', CHATGPT] as const) {
      const client = await connect(ctx);
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      for (const name of DOWNLOAD_TOOLS) {
        expect(names.includes(name), `${name} on ${JSON.stringify(ctx)}`).toBe(ctx !== CHATGPT);
      }
      await client.close();
    }
  });

  it('answers a download call from an old ChatGPT chat without calling the API', async () => {
    const client = await connect(CHATGPT);
    for (const name of DOWNLOAD_TOOLS) {
      const result = await client.callTool({ name, arguments: { generation_id: 'gen1', format: 'svg' } });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("Downloads aren't available in ChatGPT");
    }
    expect(svgmakerService.downloadGeneration).not.toHaveBeenCalled();
    await client.close();
  });
});

describe('buildFileResult', () => {
  const args = [
    'SVG generated successfully.',
    'https://svgmaker.io/api/files/t',
    'svg',
    '12h',
    { generationId: 'gen1', creditCost: 2 },
    undefined,
  ] as const;

  it('over stdio keeps the URL in the text and reads no balances', async () => {
    vi.mocked(svgmakerService.getAccountInfo).mockClear();
    const result = await buildFileResult(...args, { transport: 'stdio' });
    expect(result.content[0].text).toBe(
      'SVG generated successfully.\nURL: https://svgmaker.io/api/files/t (URL expires in 12h)'
    );
    expect(result.structuredContent).toEqual({ format: 'svg', generationId: 'gen1' });
    expect(result._meta).toBeUndefined();
    expect(svgmakerService.getAccountInfo).not.toHaveBeenCalled();
  });

  it('on the plain HTTP endpoint keeps the URL in the text and reads no balances', async () => {
    vi.mocked(svgmakerService.getAccountInfo).mockClear();
    const result = await buildFileResult(...args, { transport: 'http' });
    expect(result.content[0].text).toContain('https://svgmaker.io/api/files/t');
    expect(result._meta).toBeUndefined();
    expect(svgmakerService.getAccountInfo).not.toHaveBeenCalled();
  });

  it('on the ChatGPT endpoint links the generations page and gives the file only to the card', async () => {
    vi.mocked(svgmakerService.getAccountInfo).mockResolvedValue({
      credits: 5,
      premiumCredits: 35,
    } as any);
    vi.mocked(svgmakerService.getGeneration).mockResolvedValue({ isPublic: false } as any);
    const result = await buildFileResult(...args, CHATGPT);
    expect(result.content[0].text).toMatch(
      /^SVG generated successfully\.\nSVGMaker generations page: https:\/\/svgmaker\.io\/generations\nThe user already sees this file/
    );
    const modelSees = JSON.stringify([result.content, result.structuredContent]);
    expect(modelSees).not.toContain('/api/files/');
    expect(modelSees).not.toContain('35');
    expect(modelSees).not.toContain('base64');
    expect(result.structuredContent).toEqual({ format: 'svg', generationId: 'gen1' });
    expect(result._meta).toEqual({
      'svgmaker/file': {
        url: 'https://svgmaker.io/api/files/t',
        openUrl: 'https://svgmaker.io/generations?open=gen1',
        editUrl: 'https://svgmaker.io/editor?generationId=gen1',
        generationsUrl: 'https://svgmaker.io/generations',
        preview: 'data:image/webp;base64,UFJFVklFVw==',
        creditsUsed: 2,
        premiumCredits: 35,
        credits: 5,
      },
    });
  });

  it('on the ChatGPT endpoint links the share page of a public generation', async () => {
    vi.mocked(svgmakerService.getAccountInfo).mockResolvedValue({ credits: 5 } as any);
    vi.mocked(svgmakerService.getGeneration).mockResolvedValue({ isPublic: true } as any);
    const result = await buildFileResult(...args, CHATGPT);
    expect(result.content[0].text).toContain(
      'SVGMaker page for this image: https://svgmaker.io/share/gen1'
    );
    expect(result._meta?.['svgmaker/file']).toMatchObject({
      shareUrl: 'https://svgmaker.io/share/gen1',
    });
  });

  it('on the ChatGPT endpoint leaves out what it cannot read', async () => {
    vi.mocked(svgmakerService.getAccountInfo).mockRejectedValue(new Error('down'));
    vi.mocked(svgmakerService.getGeneration).mockRejectedValue(new Error('down'));
    const result = await buildFileResult(...args, CHATGPT);
    expect(result.content[0].text).toContain('SVGMaker generations page');
    expect(result._meta?.['svgmaker/file']).toEqual({
      url: 'https://svgmaker.io/api/files/t',
      openUrl: 'https://svgmaker.io/generations?open=gen1',
      editUrl: 'https://svgmaker.io/editor?generationId=gen1',
      generationsUrl: 'https://svgmaker.io/generations',
      preview: 'data:image/webp;base64,UFJFVklFVw==',
      creditsUsed: 2,
    });
  });
});

describe('buildListResult', () => {
  it('outside ChatGPT returns only the text', async () => {
    const result = await buildListResult('ids', ['a'], 'generations', undefined, {
      transport: 'http',
    });
    expect(result).toEqual({ content: [{ type: 'text', text: 'ids' }] });
  });

  it('links public generations to their share page and private ones to the generations page', async () => {
    vi.mocked(fetchCardPreview).mockImplementation(async (url) => {
      if (url === 'https://svgmaker.io/images/preview/private') throw new Error('HTTP 401');
      return `data:${url}`;
    });
    vi.mocked(svgmakerService.downloadGeneration).mockResolvedValue({
      url: 'https://svgmaker.io/api/files/p',
    } as any);
    const result = await buildListResult(
      'ids',
      ['public', 'private'],
      'generations',
      undefined,
      CHATGPT
    );
    expect(result.content[0].text).toMatch(/^ids\nThe user already sees these images/);
    expect(result._meta?.['svgmaker/list']).toEqual({
      items: [
        {
          id: 'public',
          preview: 'data:https://svgmaker.io/images/preview/public',
          url: 'https://svgmaker.io/generations?open=public',
          editUrl: 'https://svgmaker.io/editor?generationId=public',
        },
        {
          id: 'private',
          preview: 'data:https://svgmaker.io/api/files/p',
          url: 'https://svgmaker.io/generations?open=private',
          editUrl: 'https://svgmaker.io/editor?generationId=private',
        },
      ],
      total: 2,
      moreUrl: 'https://svgmaker.io/generations',
    });
    vi.mocked(fetchCardPreview).mockResolvedValue('data:image/webp;base64,UFJFVklFVw==');
  });

  it('shows at most 12 gallery thumbnails and keeps a tile it cannot read', async () => {
    vi.mocked(fetchCardPreview).mockRejectedValueOnce(new Error('HTTP 404'));
    const ids = Array.from({ length: 20 }, (_, i) => `g${i}`);
    const result = await buildListResult('ids', ids, 'gallery', undefined, CHATGPT);
    const card = result._meta?.['svgmaker/list'];
    expect(card?.items).toHaveLength(12);
    expect(card?.total).toBe(20);
    expect(card?.items[0]).toEqual({
      id: 'g0',
      url: 'https://svgmaker.io/share/g0',
    });
    expect(card?.moreUrl).toBe('https://svgmaker.io/gallery');
  });

  it('counts the whole list, not just this page, except for a single image', async () => {
    const page = await buildListResult('ids', ['a', 'b'], 'gallery', undefined, CHATGPT, 500);
    expect(page._meta?.['svgmaker/list']?.total).toBe(500);
    const one = await buildListResult('ids', ['a'], 'generations', undefined, CHATGPT, 80);
    expect(one._meta?.['svgmaker/list']?.total).toBe(1);
  });

  it('fetches a single image at full size and thumbnails at 384', async () => {
    await buildListResult('ids', ['one'], 'gallery', undefined, CHATGPT);
    expect(vi.mocked(fetchCardPreview)).toHaveBeenLastCalledWith(
      'https://svgmaker.io/images/preview/one',
      undefined
    );
    await buildListResult('ids', ['a', 'b'], 'gallery', undefined, CHATGPT);
    expect(vi.mocked(fetchCardPreview)).toHaveBeenLastCalledWith(
      'https://svgmaker.io/images/preview/b',
      384
    );
  });
});

describe('withImageCard', () => {
  const image = { content: [{ type: 'image' as const, data: 'UE5H', mimeType: 'image/png' }] };

  it('outside ChatGPT returns the result unchanged', async () => {
    expect(await withImageCard(image, 'gen1', 'generations', undefined, { transport: 'http' })).toBe(
      image
    );
  });

  it('gives a generation Edit and opens it on the generations page', async () => {
    const result = await withImageCard(image, 'gen1', 'generations', undefined, CHATGPT);
    expect(result.content[0]).toEqual(image.content[0]);
    expect(result.content[1]).toMatchObject({ type: 'text' });
    expect(result.structuredContent).toEqual({ format: 'svg', generationId: 'gen1' });
    expect(result._meta?.['svgmaker/file']).toEqual({
      url: 'https://svgmaker.io/generations?open=gen1',
      editUrl: 'https://svgmaker.io/editor?generationId=gen1',
      generationsUrl: 'https://svgmaker.io/generations',
      preview: 'data:image/webp;base64,UFJFVklFVw==',
    });
  });

  it('gives a gallery item its public page and no Edit', async () => {
    vi.mocked(fetchCardPreview).mockRejectedValueOnce(new Error('HTTP 404'));
    const result = await withImageCard(image, 'g1', 'gallery', undefined, CHATGPT);
    expect(result._meta?.['svgmaker/file']).toEqual({
      url: 'https://svgmaker.io/share/g1',
      generationsUrl: 'https://svgmaker.io/generations',
      preview: undefined,
    });
  });
});

describe('buildErrorResult', () => {
  const outOfCredits = Object.assign(new Error('Not enough credits'), {
    name: 'InsufficientCreditsError',
  });

  it('outside ChatGPT returns only the text', () => {
    expect(buildErrorResult('Error', outOfCredits, { transport: 'http' })).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error' }],
    });
  });

  it('explains insufficient credits without a purchase link', () => {
    const result = buildErrorResult('Error', outOfCredits, CHATGPT);
    expect(result.content[0].text).toContain('insufficient credits');
    expect(result.content[0].text).not.toContain('https://');
  });

  it('explains insufficient credits when the SDK rethrows it as AbortError', () => {
    const wrapped = Object.assign(new Error('Insufficient credits'), { name: 'AbortError' });
    expect(buildErrorResult('Error', wrapped, CHATGPT).content[0].text).toContain(
      'insufficient credits'
    );
  });

  it('on the ChatGPT endpoint returns only the text for any other error', () => {
    expect(buildErrorResult('Error', new Error('timeout'), CHATGPT).content[0].text).toBe('Error');
  });

  it('is what a failed tool call returns on the ChatGPT endpoint', async () => {
    vi.mocked(svgmakerService.generateSVG).mockRejectedValue(outOfCredits);
    const client = await connect(CHATGPT);
    const result = await client.callTool({ name: 'svgmaker_generate', arguments: { prompt: 'a' } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('insufficient credits');
    expect(JSON.stringify(result.content)).not.toContain('/pricing');
    await client.close();
  });
});

describe('attached ChatGPT files', () => {
  const FILE_TOOLS = ['svgmaker_edit', 'svgmaker_convert', 'svgmaker_remove_background'];

  it('declares a full file schema in openai/fileParams on the ChatGPT endpoint only', async () => {
    const chatgpt = await connect(CHATGPT);
    const { tools } = await chatgpt.listTools();
    for (const name of FILE_TOOLS) {
      const tool = tools.find((candidate) => candidate.name === name);
      expect(tool?._meta?.['openai/fileParams'], name).toEqual(['file']);
      const file = (tool?.inputSchema.properties as Record<string, any>).file;
      expect(Object.keys(file.properties).sort()).toEqual([
        'download_url',
        'file_id',
        'file_name',
        'mime_type',
      ]);
      expect(file.required).toEqual(['download_url', 'file_id']);
    }
    expect(tools.some((tool) => tool.name === 'svgmaker_upload')).toBe(false);
    await chatgpt.close();

    const plain = await connect('http');
    const plainTools = (await plain.listTools()).tools;
    expect(plainTools.some((tool) => tool._meta?.['openai/fileParams'])).toBe(false);
    expect(plainTools.some((tool) => tool.name === 'svgmaker_upload')).toBe(true);
    await plain.close();
  });

  it('passes an attached file to the tool as its https input', async () => {
    vi.mocked(svgmakerService.convertImageToSVG).mockClear();
    vi.mocked(svgmakerService.convertImageToSVG).mockResolvedValue({
      svgUrl: 'https://svgmaker.io/result.svg',
    } as any);
    vi.mocked(svgmakerService.getAccountInfo).mockResolvedValue({ credits: 1 } as any);
    const client = await connect(CHATGPT);
    const result = await client.callTool({
      name: 'svgmaker_convert',
      arguments: {
        file: { download_url: 'https://files.example.com/cat.png', file_id: 'file_1' },
      },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(vi.mocked(svgmakerService.convertImageToSVG).mock.calls[0])).toContain(
      'https://files.example.com/cat.png'
    );
    await client.close();
  });
});

describe('ChatGPT instructions', () => {
  it('are sent on the ChatGPT endpoint only', async () => {
    const chatgpt = await connect(CHATGPT);
    expect(chatgpt.getInstructions()).toContain('Never show a picture from the web');
    await chatgpt.close();
    const plain = await connect('http');
    expect(plain.getInstructions()).toBeUndefined();
    await plain.close();
  });
});
