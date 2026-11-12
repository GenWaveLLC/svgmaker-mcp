import { readFile } from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';

// Bump the version in a URI whenever its HTML changes: ChatGPT caches widgets by URI.
const RESULT_CARD_URI = 'ui://svgmaker/result-card-v26.html';
const LIST_CARD_URI = 'ui://svgmaker/list-card-v10.html';

/**
 * Every widget: its ui:// URI, the built HTML file in ./widgets (copied from
 * svgmaker/chatgpt-plugin) and what it shows, told to the model so it doesn't repeat it.
 */
const WIDGETS = [
  {
    uri: RESULT_CARD_URI,
    file: 'result-card.html',
    name: 'SVGMaker result card',
    description: 'Preview of an SVGMaker image, with Edit and Open buttons.',
    shows: 'Shows the image with Edit and Open buttons and, for a new image, the credits used.',
  },
  {
    uri: LIST_CARD_URI,
    file: 'list-card.html',
    name: 'SVGMaker list card',
    description: 'Thumbnails of SVGMaker images, each opening its SVGMaker page.',
    shows: 'Shows the images as thumbnails, each opening its SVGMaker page.',
  },
];

// Saved chats may ask for an older card; the current card still reads their results.
const OLD_RESULT_CARD = /^ui:\/\/svgmaker\/result-card-v\d+\.html$/;
const OLD_LIST_CARD = /^ui:\/\/svgmaker\/list-card-v\d+\.html$/;

/** Tools that show a widget, by tool name. */
const TOOL_WIDGETS: Record<string, string> = {
  svgmaker_generate: RESULT_CARD_URI,
  svgmaker_edit: RESULT_CARD_URI,
  svgmaker_convert: RESULT_CARD_URI,
  svgmaker_remove_background: RESULT_CARD_URI,
  svgmaker_generations_get: RESULT_CARD_URI,
  svgmaker_generations_preview: RESULT_CARD_URI,
  svgmaker_gallery_preview: RESULT_CARD_URI,
  svgmaker_generations_list: LIST_CARD_URI,
  svgmaker_gallery_list: LIST_CARD_URI,
};

// Hosted file URLs (/api/files/...) are served by the same svgmaker.io host that runs OAuth.
const FILE_ORIGIN = (process.env.SVGMAKER_AUTH_SERVER_URL || 'https://svgmaker.io').replace(
  /\/+$/,
  ''
);

/** What ChatGPT's model is told about this server, in the initialize result. */
export const CHATGPT_INSTRUCTIONS =
  "Never show a picture from the web to stand for an SVGMaker image: it is not the user's image. SVGMaker images appear only in the SVGMaker card. A list tool's card already shows its images, so never preview an image a list card just showed. To show one image the user names, call svgmaker_generations_preview or svgmaker_gallery_preview. To point the user at their images, link the SVGMaker generations page. To change an SVGMaker image, call svgmaker_edit with `input` set to that result's generationId. Share or delete an image only when explicitly requested. Files are downloaded on svgmaker.io, from the card's Open button, never in ChatGPT; whether the user can download depends on their SVGMaker plan, so never promise a download or suggest upgrading. A failed or timed-out generate, edit, convert or remove-background call may still have made and charged an image: call svgmaker_generations_list before retrying, and never tell the user an image is unchanged or was not made without checking. When a tool result shows an SVGMaker card, reply in one short sentence: never write a generation id or repeat what the card shows, and describe the image only when the user asks.";

/** The answer to a download tool call from an old ChatGPT chat: ChatGPT has no download tools. */
export const CHATGPT_DOWNLOAD_ERROR =
  "Downloads aren't available in ChatGPT. Open the image on svgmaker.io from its card; downloading there depends on your SVGMaker plan.";

/** The user's generations page on that same host. */
export const GENERATIONS_URL = `${FILE_ORIGIN}/generations`;

/** The SVG editor on that same host; `?generationId=` opens one of the user's images. */
export const EDITOR_URL = `${FILE_ORIGIN}/editor`;

/** The public gallery page. */
export const GALLERY_URL = `${FILE_ORIGIN}/gallery`;

/** The gallery page opened on a search, or the whole gallery without one. */
export function gallerySearchUrl(query?: string): string {
  const q = query?.trim();
  return q ? `${GALLERY_URL}?query=${encodeURIComponent(q)}` : GALLERY_URL;
}

/** The public page of a public generation, where anyone can download it. */
export function shareUrl(generationId: string): string {
  return `${FILE_ORIGIN}/share/${generationId}`;
}

/** The WebP preview of a public generation; private ones answer 401. */
export function publicPreviewUrl(generationId: string): string {
  return `${FILE_ORIGIN}/images/preview/${generationId}`;
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
      (OLD_RESULT_CARD.test(uri) ? WIDGETS.find((w) => w.uri === RESULT_CARD_URI) : undefined) ??
      (OLD_LIST_CARD.test(uri) ? WIDGETS.find((w) => w.uri === LIST_CARD_URI) : undefined);
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
              // No full-width ChatGPT frame: the cards are sized to their images.
              prefersBorder: false,
            },
            // Only in the chat, like ChatGPT's own images: no side panel or "Open in app".
            'openai/ui': { availableDisplayModes: ['inline'] },
            'openai/widgetDescription': widget.shows,
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
