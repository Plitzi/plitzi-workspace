/** The widget render of `plitzi_render`, on its own: operations in, a self-contained `offlineData` out — no server, no
 *  space, no OAuth.
 *
 *  Import it as `@plitzi/sdk-mcp/render` in a project whose own agent draws UI in its own pages: register `render` as
 *  a tool of the project's MCP server with `renderWidgetShape` as its input and `renderGuideText` for the agent to read,
 *  hand it `base` — the style of the project's space — so the widget looks like the page around it, and draw the
 *  answer with the `plitziSdk` element (its `offlineData`). */

export { HOST_PAGE_REF as RENDER_ROOT_REF, render, renderWidgetShape } from './modules/mcp/tools/renderWidget';
export { renderGuideText } from './modules/mcp/resources/renderGuide';

export type {
  RenderOptions,
  RenderResponse,
  RenderWidgetInput
} from './modules/mcp/tools/renderWidget';
