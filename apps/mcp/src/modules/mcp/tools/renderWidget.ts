/**
 * A widget built from an agent's operations, with no space and no backend: the engine behind `plitzi_render`, apart
 * from the MCP tool — so a project's own agent can draw the same widgets in its own pages (`@plitzi/sdk-mcp/render`).
 */
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { documentOperations } from './operations';
import { emptySpace } from '../helpers';
import { proxifyResources } from '../proxy';
import { draftBatch } from './shared/draftBatch';
import { interactionReport } from './shared/interactionReport';

import type { Space } from '../helpers';
import type { ResourceProxy } from '../proxy';
import type { Operation } from './operations';
import type { OfflineDataRaw, Style } from '@plitzi/sdk-shared';

// The id of the throwaway host page every render is authored into. Elements/definitions target it via
// `pageRef: "render"`; it is the tree root the offline SDK mounts. Kept stable so the tool description can name it.
export const HOST_PAGE_REF = 'render';

// An empty space with a single host page — the seed a render authors into. Built on the shared emptySpace() so the
// widget renders from this schema + style alone: no real space, no cloud.
const seedSpace = (base?: Style): Space => {
  const space = emptySpace();
  if (base) {
    // Its own copy, compiled again below with whatever the widget adds.
    space.style = { ...structuredClone(base), cache: '' };
  }

  space.schema.definition.name = 'Widget';
  space.schema.flat[HOST_PAGE_REF] = {
    id: HOST_PAGE_REF,
    attributes: { slug: '', name: 'Render', default: true },
    definition: { rootId: HOST_PAGE_REF, label: 'Page', type: 'page', items: [], styleSelectors: { base: '' } }
  };
  space.schema.pages = [HOST_PAGE_REF];

  return space;
};

const noWarnings = (warnings: string[]): string[] | undefined => (warnings.length > 0 ? warnings : undefined);

/** What a widget is built from: the operations an agent authored under the root page `render`. */
export type RenderWidgetInput = { operations: Operation[] };

/** The input as a tool declares it, for a project registering the render as a tool of its own MCP server. */
export const renderWidgetShape = { operations: documentOperations };

/** What the render needs from its host beyond the operations. Each optional. */
export type RenderOptions = {
  /** Where the widget's external URLs are fetched for it. Without one they travel as authored, and load only where
   *  the surface allows their origin. */
  proxy?: ResourceProxy;
  /**
   * The style of the space that shows the widget — its tokens in both themes, its classes, its fonts — for a widget
   * drawn in a project's own page: it then looks like the page around it, and may use its classes. Left out, the
   * widget starts from nothing, as one shown in an agent's chat does.
   */
  base?: Style;
};

export type RenderResponse =
  | { rendered: false; errors: { path: string; message: string; hint?: string }[]; warnings?: string[] }
  | {
      rendered: true;
      rootRef: string;
      elementCount: number;
      offlineData: OfflineDataRaw;
      /** The batch this render was built from, EXPANDED (repeats already unrolled). The view keeps it so a later
       *  patch has something to merge into; it is never shown to the model. */
      operations: Operation[];
      /** One line per interaction flow the widget actually stored — what got wired to what. Absent when the
       *  widget has no flows, which is most of them. */
      interactions?: string[];
      warnings?: string[];
    };

// Build a self-contained render payload from agent-authored operations, WITHOUT any space or cloud. The ops are
// applied to a throwaway seed space (one host page) through the same draftBatch as plitzi_apply, then the style cache is compiled and the result returned as OfflineDataRaw — the SDK's
// offline render input. The agent authors the widget by targeting `pageRef: "render"`.
export const render = (input: RenderWidgetInput, options: RenderOptions = {}): RenderResponse => {
  const result = draftBatch(seedSpace(options.base), 'main', input.operations, 'widget');
  if (!result.ok) {
    return { rendered: false, errors: result.errors, warnings: noWarnings(result.warnings) };
  }

  const { ops, draft: space } = result;
  const behaviour = interactionReport(space);
  const warnings = [...result.warnings, ...behaviour.warnings];

  // A widget renders inside the host's sandbox, under a CSP built from the origins this server declared BEFORE
  // any widget existed (it belongs to the ui:// resource, and the protocol has no per-call CSP) — so an external
  // URL stays blocked however good it is, unless it is loaded from an origin that IS declared. Point everything
  // the widget loads at this server's endpoint, before the CSS is compiled so the concatenated cache comes out
  // already rewritten. The agent is not part of this: it authored the real URLs and never sees the rewrite.
  if (options.proxy) {
    warnings.push(...proxifyResources(space, options.proxy));
  }

  // Compile the global style cache from the per-item caches the style ops just wrote — the offline SDK reads
  // Style.cache, so it must be concatenated here just as persisting a real space would.
  space.style.cache = generateCache(space.style);

  return {
    rendered: true,
    operations: ops,
    ...(behaviour.flows ? { interactions: behaviour.flows } : {}),
    rootRef: HOST_PAGE_REF,
    // Every flat entry except the host page is a real authored element.
    elementCount: Object.keys(space.schema.flat).length - 1,
    offlineData: { schema: space.schema, style: space.style },
    warnings: noWarnings(warnings)
  };
};
