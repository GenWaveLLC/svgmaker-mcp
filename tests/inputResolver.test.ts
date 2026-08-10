import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

vi.mock('../src/services/svgmakerService.js', () => ({
  editSVG: vi.fn(),
  convertImageToSVG: vi.fn(),
  removeBackground: vi.fn(),
  downloadGeneration: vi.fn(),
  downloadGalleryItem: vi.fn(),
}));

import * as svgmakerService from '../src/services/svgmakerService.js';
import { handleEditTool } from '../src/tools/editTool.js';
import { handleConvertTool } from '../src/tools/convertTool.js';
import { handleRemoveBackgroundTool } from '../src/tools/removeBackgroundTool.js';
import { handlePreviewTool } from '../src/tools/previewTool.js';
import {
  classifyInput,
  selectImageSource,
  resolveImageInput,
  GENERATION_ID_UNSUPPORTED_ERROR,
  HTTP_LOCAL_PATH_ERROR,
} from '../src/utils/inputResolver.js';

const HTTP = { transport: 'http' } as const;
const STDIO = { transport: 'stdio' } as const;

const server = {} as Server;

function call(name: string, args: Record<string, unknown>) {
  return { params: { name, arguments: args } };
}

let tmpDir: string;
let localImage: string;

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  // Not os.tmpdir(): on macOS it lives under /var, which resolveAndValidatePath blacklists.
  tmpDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-test-'));
  localImage = path.join(tmpDir, 'panda.png');
  await fs.writeFile(localImage, 'PNGBYTES');

  vi.mocked(svgmakerService.editSVG).mockResolvedValue({
    svgUrl: 'https://cdn.svgmaker.io/out.svg',
  } as any);
  vi.mocked(svgmakerService.convertImageToSVG).mockResolvedValue({
    svgUrl: 'https://cdn.svgmaker.io/out.svg',
  } as any);
  vi.mocked(svgmakerService.removeBackground).mockResolvedValue({
    svgUrl: 'https://cdn.svgmaker.io/out.svg',
  } as any);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('classifyInput', () => {
  it('classifies each input form', () => {
    expect(classifyInput('/Users/me/panda.png')).toBe('path');
    expect(classifyInput('file:///Users/me/panda.png')).toBe('path');
    expect(classifyInput('./panda.png')).toBe('path');
    expect(classifyInput('https://example.com/logo.png')).toBe('url');
    expect(classifyInput('upl_abc123')).toBe('upload');
    expect(classifyInput('gen_abc123')).toBe('generation');
  });
});

describe('selectImageSource', () => {
  it('requires exactly one source', () => {
    expect(() => selectImageSource({})).toThrow(/image source is required/);
    expect(() => selectImageSource({ input: 'a', generation_id: 'b' })).toThrow(
      /only one image source/
    );
  });

  it('pins the kind asserted by the legacy alias names', () => {
    expect(selectImageSource({ input_path: '/a/b.png' })).toEqual({
      value: '/a/b.png',
      kind: 'path',
    });
    expect(selectImageSource({ generation_id: 'gen_abc123' })).toEqual({
      value: 'gen_abc123',
      kind: 'generation',
    });
    expect(selectImageSource({ input: 'gen_abc123' })).toEqual({
      value: 'gen_abc123',
      kind: undefined,
    });
  });
});

describe('resolveImageInput', () => {
  it('reads a local path to a Buffer over stdio', async () => {
    const resolved = await resolveImageInput({ value: localImage }, STDIO);
    expect(resolved).toEqual({ kind: 'path', buffer: Buffer.from('PNGBYTES') });
  });

  it('reads a file:// URL over stdio', async () => {
    const resolved = await resolveImageInput({ value: pathToFileURL(localImage).href }, STDIO);
    expect(resolved).toEqual({ kind: 'path', buffer: Buffer.from('PNGBYTES') });
  });

  it('rejects a local path over http with an actionable message', async () => {
    await expect(resolveImageInput({ value: localImage }, HTTP)).rejects.toThrow(
      HTTP_LOCAL_PATH_ERROR
    );
  });

  it('passes an https URL through on both transports', async () => {
    const url = 'https://example.com/logo.png';
    for (const ctx of [STDIO, HTTP]) {
      expect(await resolveImageInput({ value: url }, ctx)).toEqual({ kind: 'url', imageUrl: url });
    }
  });

  it('passes a generation id through without downloading it', async () => {
    for (const ctx of [STDIO, HTTP]) {
      expect(await resolveImageInput({ value: 'gen_abc123' }, ctx)).toEqual({
        kind: 'generation',
        generationId: 'gen_abc123',
      });
    }
    expect(svgmakerService.downloadGeneration).not.toHaveBeenCalled();
    expect(svgmakerService.downloadGalleryItem).not.toHaveBeenCalled();
  });

  it('passes an upload id through on both transports', async () => {
    for (const ctx of [STDIO, HTTP]) {
      expect(await resolveImageInput({ value: 'upl_abc123' }, ctx)).toEqual({
        kind: 'upload',
        uploadId: 'upl_abc123',
      });
    }
  });

  it('rejects a generation id when the caller opts out', async () => {
    await expect(
      resolveImageInput({ value: 'gen_abc123' }, STDIO, { allowGenerationId: false })
    ).rejects.toThrow(GENERATION_ID_UNSUPPORTED_ERROR);
  });
});

const EDIT_CASE = [
  'svgmaker_edit',
  handleEditTool,
  () => svgmakerService.editSVG,
  'image',
  { prompt: 'blue' },
] as const;
const CONVERT_CASE = [
  'svgmaker_convert',
  handleConvertTool,
  () => svgmakerService.convertImageToSVG,
  'file',
  {},
] as const;
const REMOVE_BG_CASE = [
  'svgmaker_remove_background',
  handleRemoveBackgroundTool,
  () => svgmakerService.removeBackground,
  'file',
  {},
] as const;

// prettier-ignore
describe.each([EDIT_CASE, CONVERT_CASE, REMOVE_BG_CASE])('%s input handling', (name, handler, getMock, fileField, extraArgs) => {
  it('sends a Buffer for a local path over stdio', async () => {
    const readSpy = vi.spyOn(fs, 'readFile');

    const result = await handler(
      server,
      call(name, { ...extraArgs, input: localImage }),
      undefined,
      STDIO
    );

    expect(result.isError).toBeUndefined();
    const params = vi.mocked(getMock()).mock.calls[0][0] as any;
    expect(params[fileField]).toEqual(Buffer.from('PNGBYTES'));
    expect(params.imageUrl).toBeUndefined();
    // Proves the spy used by the URL test below is actually wired to the module under test.
    expect(readSpy).toHaveBeenCalledWith(localImage);
  });

  it('rejects a local path over http without calling the API', async () => {
    const result = await handler(
      server,
      call(name, { ...extraArgs, input: localImage }),
      undefined,
      HTTP
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(HTTP_LOCAL_PATH_ERROR);
    expect(getMock()).not.toHaveBeenCalled();
  });

  it('passes a URL through as imageUrl without reading the filesystem', async () => {
    const readSpy = vi.spyOn(fs, 'readFile');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    for (const ctx of [STDIO, HTTP]) {
      vi.mocked(getMock()).mockClear();
      const result = await handler(
        server,
        call(name, { ...extraArgs, input: 'https://example.com/logo.png' }),
        undefined,
        ctx
      );

      expect(result.isError).toBeUndefined();
      const params = vi.mocked(getMock()).mock.calls[0][0] as any;
      expect(params.imageUrl).toBe('https://example.com/logo.png');
      expect(params[fileField]).toBeUndefined();
    }

    expect(readSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes an upl_ id through as uploadId without reading the filesystem', async () => {
    const readSpy = vi.spyOn(fs, 'readFile');

    for (const ctx of [STDIO, HTTP]) {
      vi.mocked(getMock()).mockClear();
      const result = await handler(
        server,
        call(name, { ...extraArgs, input: 'upl_abc123' }),
        undefined,
        ctx
      );

      expect(result.isError).toBeUndefined();
      const params = vi.mocked(getMock()).mock.calls[0][0] as any;
      expect(params.uploadId).toBe('upl_abc123');
      expect(params.generationId).toBeUndefined();
      expect(params.imageUrl).toBeUndefined();
      expect(params[fileField]).toBeUndefined();
    }

    expect(readSpy).not.toHaveBeenCalled();
  });

  it('still accepts the input_path alias', async () => {
    const result = await handler(
      server,
      call(name, { ...extraArgs, input_path: localImage }),
      undefined,
      STDIO
    );

    expect(result.isError).toBeUndefined();
    const params = vi.mocked(getMock()).mock.calls[0][0] as any;
    expect(params[fileField]).toEqual(Buffer.from('PNGBYTES'));
  });

  it('errors when more than one source is supplied', async () => {
    const result = await handler(
      server,
      call(name, { ...extraArgs, input: localImage, input_path: localImage }),
      undefined,
      STDIO
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('only one image source');
  });

  it('errors when no source is supplied', async () => {
    const result = await handler(server, call(name, { ...extraArgs }), undefined, STDIO);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('image source is required');
  });
});

// prettier-ignore
describe.each([EDIT_CASE, REMOVE_BG_CASE])('%s generation ids', (name, handler, getMock, fileField, extraArgs) => {
  it('passes the id through as generationId without downloading it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    for (const ctx of [STDIO, HTTP]) {
      vi.mocked(getMock()).mockClear();
      const result = await handler(
        server,
        call(name, { ...extraArgs, input: 'gen_abc123' }),
        undefined,
        ctx
      );

      expect(result.isError).toBeUndefined();
      const params = vi.mocked(getMock()).mock.calls[0][0] as any;
      expect(params.generationId).toBe('gen_abc123');
      expect(params.imageUrl).toBeUndefined();
      expect(params[fileField]).toBeUndefined();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(svgmakerService.downloadGeneration).not.toHaveBeenCalled();
    expect(svgmakerService.downloadGalleryItem).not.toHaveBeenCalled();
  });

  it('still accepts the generation_id alias', async () => {
    const result = await handler(
      server,
      call(name, { ...extraArgs, generation_id: 'gen_abc123' }),
      undefined,
      STDIO
    );

    expect(result.isError).toBeUndefined();
    const params = vi.mocked(getMock()).mock.calls[0][0] as any;
    expect(params.generationId).toBe('gen_abc123');
  });
});

describe('svgmaker_convert generation ids', () => {
  it('rejects a bare generation id without calling the API', async () => {
    const result = await handleConvertTool(
      server,
      call('svgmaker_convert', { input: 'gen_abc123' }),
      undefined,
      STDIO
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(GENERATION_ID_UNSUPPORTED_ERROR);
    expect(svgmakerService.convertImageToSVG).not.toHaveBeenCalled();
  });

  it('ignores a generation_id argument, which is no longer part of the schema', async () => {
    const result = await handleConvertTool(
      server,
      call('svgmaker_convert', { generation_id: 'gen_abc123' }),
      undefined,
      STDIO
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('image source is required');
    expect(svgmakerService.convertImageToSVG).not.toHaveBeenCalled();
  });
});

describe('svgmaker_preview input alias', () => {
  it.each(['input', 'file_path'])('accepts %s', async (param) => {
    const svgPath = path.join(tmpDir, 'icon.svg');
    await fs.writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

    const result = await handlePreviewTool(
      server,
      call('svgmaker_preview', { [param]: svgPath }),
      undefined,
      STDIO
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe('image');
  });

  it('rejects both params at once', async () => {
    const result = await handlePreviewTool(
      server,
      call('svgmaker_preview', { input: localImage, file_path: localImage }),
      undefined,
      STDIO
    );

    expect(result.isError).toBe(true);
  });
});
