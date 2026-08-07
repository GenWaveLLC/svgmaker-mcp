/**
 * Per-request context threaded from the entry point down to every tool handler.
 *
 * `transport` is passed explicitly by each entry point rather than inferred from
 * the presence of a client: over HTTP the server has no access to the caller's
 * filesystem, and guessing that wrong fails silently.
 */
export interface ToolContext {
  transport: 'stdio' | 'http';
}

export const DEFAULT_TOOL_CONTEXT: ToolContext = { transport: 'stdio' };
