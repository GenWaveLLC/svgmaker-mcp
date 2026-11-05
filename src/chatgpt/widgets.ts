import { readFile } from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';

// Bump the version in a URI whenever its HTML changes: ChatGPT caches widgets by URI.
const RESULT_CARD_URI = 'ui://svgmaker/result-card-v9.html';

/** Every widget: its ui:// URI and the built HTML file in ./widgets (copied from svgmaker/chatgpt-plugin). */
const WIDGETS = [
  {
    uri: RESULT_CARD_URI,
    file: 'result-card.html',
    name: 'SVGMaker result card',
    description: 'Preview of an image SVGMaker made, with a download button.',
  },
];

// Saved chats may ask for an older result card; the current card still reads their results.
const OLD_RESULT_CARD = /^ui:\/\/svgmaker\/result-card-v\d+\.html$/;

/** Tools that show a widget, by tool name. */
const TOOL_WIDGETS: Record<string, string> = {
  svgmaker_generate: RESULT_CARD_URI,
  svgmaker_edit: RESULT_CARD_URI,
  svgmaker_convert: RESULT_CARD_URI,
  svgmaker_remove_background: RESULT_CARD_URI,
};

// Hosted file URLs (/api/files/...) are served by the same svgmaker.io host that runs OAuth.
const FILE_ORIGIN = (process.env.SVGMAKER_AUTH_SERVER_URL || 'https://svgmaker.io').replace(
  /\/+$/,
  ''
);

/** What ChatGPT's model is told about this server, in the initialize result. */
export const CHATGPT_INSTRUCTIONS =
  "Never show a picture from the web to stand for an SVGMaker image: it is not the user's image. SVGMaker images appear only in the SVGMaker card. To show one the user asks to see, call svgmaker_generations_preview or svgmaker_gallery_preview. To point the user at their images, link the SVGMaker generations page. To change an SVGMaker image, call svgmaker_edit with its generation_id; never use another image tool for it.";

/** The user's generations page on that same host. */
export const GENERATIONS_URL = `${FILE_ORIGIN}/generations`;

/** The public page of a public generation, where anyone can download it. */
export function shareUrl(generationId: string): string {
  return `${FILE_ORIGIN}/share/${generationId}`;
}

/** Add the widget link to a tool definition when the tool has one. */
export function withWidget<T extends { name: string }>(tool: T): T {
  const resourceUri = TOOL_WIDGETS[tool.name];
  return resourceUri ? { ...tool, _meta: { ui: { resourceUri } } } : tool;
}

/** Answer resources/list and resources/read with the widget HTML. */
export function registerWidgetResources(server: Server): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: WIDGETS.map(({ uri, name, description }) => ({
      uri,
      name,
      description,
      mimeType: WIDGET_MIME_TYPE,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const widget =
      WIDGETS.find((w) => w.uri === uri) ??
      (OLD_RESULT_CARD.test(uri) ? WIDGETS.find((w) => w.uri === RESULT_CARD_URI) : undefined);
    if (!widget) {
      throw new Error(`Unknown resource: ${uri}`);
    }
    const html = await readFile(new URL(`./widgets/${widget.file}`, import.meta.url), 'utf8');
    return {
      contents: [
        {
          uri,
          mimeType: WIDGET_MIME_TYPE,
          text: html,
          _meta: {
            ui: {
              domain: 'https://mcp.svgmaker.io',
              csp: { connectDomains: [FILE_ORIGIN], resourceDomains: [FILE_ORIGIN] },
              prefersBorder: true,
            },
            // Tells the model what the card already shows, so it doesn't repeat it.
            'openai/widgetDescription':
              'Shows the image with its credits used, credits left and a download button.',
            // ChatGPT reads openExternal targets only from the legacy CSP key.
            'openai/widgetCSP': {
              connect_domains: [FILE_ORIGIN],
              resource_domains: [FILE_ORIGIN],
              redirect_domains: [FILE_ORIGIN],
            },
          },
        },
      ],
    };
  });
}
