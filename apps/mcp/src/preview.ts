/** The draft-preview endpoint alone, for the page server that mounts it: `POST /__preview` applies unsaved operations
 *  to a copy of the draft and renders it.
 *
 *  Import it as `@plitzi/sdk-mcp/preview`. The package root carries the MCP server too — its SDK, its tools, its
 *  resources — which a page server never runs; and what a preview itself needs (the operations, their lint, the
 *  render) is loaded by the first preview the process is asked for, not when it starts. */

export { previewStage } from './stages/preview';
