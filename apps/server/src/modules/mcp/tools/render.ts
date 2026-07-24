import { validateSchema } from '@plitzi/sdk-schema';
import { generateCache } from '@plitzi/sdk-style';

import { applyOperations } from './apply/dispatch';
import { operations } from './operations';
import { emptySpace } from '../helpers';
import { defineTool } from './shared/tool';
import { validateOperations } from './shared/validator';
import { auditResources } from './shared/validator/audit';

import type { Space } from '../helpers';
import type { Operation } from './operations';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

// The idRef of the throwaway host page every render is authored into. Elements/definitions target it via
// `pageRef: "render"`; it is the tree root the offline SDK mounts. Kept stable so the tool description can name it.
const HOST_PAGE_REF = 'render';

// An empty space with a single host page — the seed a render authors into. Built on the shared emptySpace() so the
// widget renders from this schema + style alone: no real space, no cloud.
const seedSpace = (): Space => {
  const space = emptySpace();
  space.schema.definition.name = 'Widget';
  space.schema.flat[HOST_PAGE_REF] = {
    id: HOST_PAGE_REF,
    idRef: HOST_PAGE_REF,
    attributes: { slug: '', name: 'Render', default: true },
    definition: { rootId: HOST_PAGE_REF, label: 'Page', type: 'page', items: [], styleSelectors: { base: '' } }
  };
  space.schema.pages = [HOST_PAGE_REF];

  return space;
};

const noWarnings = (warnings: string[]): string[] | undefined => (warnings.length > 0 ? warnings : undefined);

export const renderShape = {
  operations
};

export type RenderInput = { operations: Operation[] };

export type RenderResponse =
  | { rendered: false; errors: { path: string; message: string; hint?: string }[]; warnings?: string[] }
  | { rendered: true; rootRef: string; elementCount: number; offlineData: OfflineDataRaw; warnings?: string[] };

// Build a self-contained render payload from agent-authored operations, WITHOUT any space or cloud. The ops are
// applied to a throwaway seed space (one host page) using the exact same validate → apply → integrity → audit
// pipeline as plitzi_apply, then the style cache is compiled and the result returned as OfflineDataRaw — the SDK's
// offline render input. The agent authors the widget by targeting `pageRef: "render"`.
export const render = (input: RenderInput): RenderResponse => {
  const space = seedSpace();

  const validation = validateOperations(space, input.operations);
  if (!validation.valid) {
    return { rendered: false, errors: validation.errors, warnings: noWarnings(validation.warnings) };
  }

  const outcome = applyOperations(space, 'main', input.operations);
  if (outcome.errors.length > 0) {
    return { rendered: false, errors: outcome.errors, warnings: noWarnings(validation.warnings) };
  }

  const integrity = validateSchema(space.schema);
  if (!integrity.valid) {
    return {
      rendered: false,
      errors: integrity.errors.map(error => ({
        path: error.elementId ? `schema.${error.elementId}` : 'schema',
        message: error.message,
        hint: 'The authored widget is structurally inconsistent (broken parent/child link or a cycle).'
      })),
      warnings: noWarnings(validation.warnings)
    };
  }

  const audit = auditResources(space, input.operations);
  const warnings = [...validation.warnings, ...audit.warnings];
  if (audit.errors.length > 0) {
    return { rendered: false, errors: audit.errors, warnings: noWarnings(warnings) };
  }

  // Compile the global style cache from the per-item caches the style ops just wrote — the offline SDK reads
  // Style.cache, so it must be concatenated here just as persisting a real space would.
  space.style.cache = generateCache(space.style);

  return {
    rendered: true,
    rootRef: HOST_PAGE_REF,
    // Every flat entry except the host page is a real authored element.
    elementCount: Object.keys(space.schema.flat).length - 1,
    offlineData: { schema: space.schema, style: space.style },
    warnings: noWarnings(warnings)
  };
};

// Split the render into what the MODEL reads (a tiny summary) and what the HOST renders (the full offlineData). The
// model authored the operations, so it never needs the assembled payload echoed back — sending it as text would
// cost thousands of tokens per widget and sit in history. The offlineData rides in `structuredContent`, delivered
// to the host renderer out-of-band; a failed render returns its (already compact) errors as text so the model can fix it.
const toRenderResult = (res: RenderResponse): CallToolResult => {
  if (!res.rendered) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ rendered: false, errors: res.errors, warnings: res.warnings }) }]
    };
  }

  const summary = { rendered: true, rootRef: res.rootRef, elementCount: res.elementCount, warnings: res.warnings };

  return {
    content: [{ type: 'text', text: JSON.stringify(summary) }],
    structuredContent: { ...summary, offlineData: res.offlineData }
  };
};

// A read-only, cloud-independent tool: the agent authors a widget as a batch of operations and gets back a
// self-contained offlineData payload the host renders with the Plitzi SDK in offline mode (no space, no backend).
export const renderTool = defineTool({
  name: 'plitzi_render',
  title: 'Render widget',
  description:
    'Render a small self-contained UI widget the user can SEE, with the Plitzi SDK offline (no backend). Reach ' +
    'for it in two cases: (1) the user asks you to create/design/build/show a piece of UI (a card, hero, form, ' +
    'button, banner, pricing table…); (2) you are answering a content question and a visual layout communicates ' +
    'better than prose — render the ANSWER as a widget (a recipe as a card, a comparison as a table, steps as a ' +
    'checklist, a profile, a menu). Prefer showing it over a long text answer whenever the content is naturally ' +
    'visual. You author the widget as operations targeting the pre-seeded host page `pageRef: "render"` (same ' +
    'vocabulary as plitzi_apply: upsertElement, upsertDefinition, …). Returns a compact summary; the rendered ' +
    'widget is shown to the user. To edit an existing space page instead, use plitzi_preview.',
  inputShape: renderShape,
  access: 'read',
  spaceless: true,
  run: input => toRenderResult(render(input))
});
