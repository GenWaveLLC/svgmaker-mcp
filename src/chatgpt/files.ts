/** Tools that take an image the user attached in ChatGPT, as a top-level `file` field. */
const FILE_TOOLS = new Set(['svgmaker_edit', 'svgmaker_convert', 'svgmaker_remove_background']);

// ChatGPT rejects a file schema that leaves out any of these four properties.
const OPENAI_FILE_SCHEMA = {
  type: 'object',
  description:
    'An image the user attached in this chat. Use it instead of `input` when the user means an image they attached.',
  properties: {
    download_url: { type: 'string' },
    file_id: { type: 'string' },
    mime_type: { type: 'string' },
    file_name: { type: 'string' },
  },
  required: ['download_url', 'file_id'],
};

// ChatGPT has no svgmaker_upload, so `input` is described without it. Naming what a
// generation ID is keeps ChatGPT from flagging it as an unexplained outbound value.
const GENERATION_ID_NOTE =
  'or the generationId of an SVGMaker result earlier in this chat. A generationId is the ID SVGMaker gave the user\'s own image; it only points at that image and carries no other data.';
const INPUT_DESCRIPTIONS: Record<string, string> = {
  svgmaker_edit: `The image to edit when it is not an attached file: an https:// image URL, ${GENERATION_ID_NOTE}`,
  svgmaker_remove_background: `The image when it is not an attached file: an https:// image URL, ${GENERATION_ID_NOTE}`,
  svgmaker_convert:
    'The raster image when it is not an attached file: an https:// image URL. Generation IDs are not accepted.',
};

interface ToolWithSchema {
  name: string;
  inputSchema: object;
  _meta?: Record<string, unknown>;
}

/**
 * Add the `file` field and `openai/fileParams` to a tool that takes an attached image,
 * and describe its `input` for ChatGPT.
 */
export function withFileParam<T extends ToolWithSchema>(tool: T): T {
  if (!FILE_TOOLS.has(tool.name)) return tool;
  const schema = tool.inputSchema as { properties?: Record<string, object> };
  const input = { ...schema.properties?.input, description: INPUT_DESCRIPTIONS[tool.name] };
  return {
    ...tool,
    inputSchema: {
      ...schema,
      properties: { ...schema.properties, input, file: OPENAI_FILE_SCHEMA },
    },
    _meta: { ...tool._meta, 'openai/fileParams': ['file'] },
  };
}

/**
 * Turn an attached `file` into the https URL `input` the tools already read.
 * Returns the arguments unchanged when there is no file.
 */
export function fileToInput(args: Record<string, unknown> | undefined) {
  const file = args?.file as { download_url?: unknown } | undefined;
  if (!args || typeof file?.download_url !== 'string') return args;
  const { file: _file, ...rest } = args;
  return { ...rest, input: file.download_url };
}
