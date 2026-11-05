# ChatGPT plugin support

ChatGPT-only parts of the HTTP server (`src/http.ts`). Plan and the widget source live in the svgmaker repo: `alfaarghya/plugin/chatgpt-svgmaker.md` and `chatgpt-plugin/`.

## What goes here

- Widget resources: `resources/list` and `resources/read` for `ui://svgmaker/*` (MIME `text/html;profile=mcp-app`, `_meta.ui.csp`, `_meta.ui.domain`).
- ChatGPT tool metadata: `_meta.ui.resourceUri`, `_meta["openai/fileParams"]`, `_meta["openai/profile"]`.
- `widgets/` - Built widget HTML copied from `svgmaker/chatgpt-plugin`. Not edited by hand.

## What does not go here

Tools and safety hints (`readOnlyHint`, `destructiveHint`, `openWorldHint`) are standard MCP and serve every client, so they stay in `src/tools/`.

## Build

`npm run build` copies `src/chatgpt/widgets/` into `build/chatgpt/widgets/`; `widgets.ts` reads the HTML from next to itself, so it works from `src/` (tsx) and `build/`.
