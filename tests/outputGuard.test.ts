import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

vi.mock('../src/services/svgmakerService.js', () => ({
  generateSVG: vi.fn(),
  editSVG: vi.fn(),
  downloadGeneration: vi.fn(),
  downloadGalleryItem: vi.fn(),
}));

import * as svgmakerService from '../src/services/svgmakerService.js';
import { handleGenerateTool } from '../src/tools/generateTool.js';
import { handleEditTool } from '../src/tools/editTool.js';
import { handleGenerationsDownloadTool } from '../src/tools/generationsTool.js';
import { HTTP_OUTPUT_PATH_ERROR } from '../src/utils/outputUtils.js';

const HTTP = { transport: 'http' } as const;
const STDIO = { transport: 'stdio' } as const;

const server = {} as Server;

function call(name: string, args: Record<string, unknown>) {
  return { params: { name, arguments: args } };
}

let tmpDir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  // Not os.tmpdir(): on macOS it lives under /var, which resolveAndValidatePath blacklists.
  tmpDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('output_path guard over the HTTPS transport', () => {
  it('rejects output_path for svgmaker_generate without calling the API', async () => {
    const result = await handleGenerateTool(
      server,
      call('svgmaker_generate', { prompt: 'a panda', output_path: '/Users/me/Desktop/panda.svg' }),
      undefined,
      HTTP
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(HTTP_OUTPUT_PATH_ERROR);
    expect(svgmakerService.generateSVG).not.toHaveBeenCalled();
  });

  it('rejects output_path for svgmaker_edit without calling the API', async () => {
    const result = await handleEditTool(
      server,
      call('svgmaker_edit', {
        prompt: 'make it blue',
        generation_id: 'gen_abc123',
        output_path: '/Users/me/Desktop/panda.svg',
      }),
      undefined,
      HTTP
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(HTTP_OUTPUT_PATH_ERROR);
    expect(svgmakerService.editSVG).not.toHaveBeenCalled();
  });

  it('rejects output_path for svgmaker_generations_download without calling the API', async () => {
    const result = await handleGenerationsDownloadTool(
      server,
      call('svgmaker_generations_download', {
        generation_id: 'gen_abc123',
        output_path: '/Users/me/Desktop/panda.svg',
      }),
      undefined,
      HTTP
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(HTTP_OUTPUT_PATH_ERROR);
    expect(svgmakerService.downloadGeneration).not.toHaveBeenCalled();
  });

  it('returns a hosted URL when no output_path is given', async () => {
    vi.mocked(svgmakerService.generateSVG).mockResolvedValue({
      svgUrl: 'https://cdn.svgmaker.io/panda.svg',
      svgUrlExpiresIn: '24h',
    } as any);

    const result = await handleGenerateTool(
      server,
      call('svgmaker_generate', { prompt: 'a panda' }),
      undefined,
      HTTP
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('https://cdn.svgmaker.io/panda.svg');
  });
});

describe('output_path over the stdio transport', () => {
  it('writes the generated SVG to disk', async () => {
    vi.mocked(svgmakerService.generateSVG).mockResolvedValue({
      svgText: '<svg />',
    } as any);
    const outputPath = path.join(tmpDir, 'panda.svg');

    const result = await handleGenerateTool(
      server,
      call('svgmaker_generate', { prompt: 'a panda', output_path: outputPath }),
      undefined,
      STDIO
    );

    expect(result.isError).toBeUndefined();
    expect(await fs.readFile(outputPath, 'utf8')).toBe('<svg />');
  });

  it('writes the downloaded generation to disk', async () => {
    vi.mocked(svgmakerService.downloadGeneration).mockResolvedValue({
      url: 'https://cdn.svgmaker.io/panda.svg',
      format: 'svg',
    } as any);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<svg />'));
    const outputPath = path.join(tmpDir, 'panda.svg');

    const result = await handleGenerationsDownloadTool(
      server,
      call('svgmaker_generations_download', {
        generation_id: 'gen_abc123',
        output_path: outputPath,
        format: 'svg',
      }),
      undefined,
      STDIO
    );

    expect(result.isError).toBeUndefined();
    expect(await fs.readFile(outputPath, 'utf8')).toBe('<svg />');
  });

  it('defaults to stdio when no context is passed', async () => {
    vi.mocked(svgmakerService.generateSVG).mockResolvedValue({
      svgText: '<svg />',
    } as any);
    const outputPath = path.join(tmpDir, 'default.svg');

    const result = await handleGenerateTool(
      server,
      call('svgmaker_generate', { prompt: 'a panda', output_path: outputPath })
    );

    expect(result.isError).toBeUndefined();
    expect(await fs.readFile(outputPath, 'utf8')).toBe('<svg />');
  });
});
