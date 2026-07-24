import { validateSchema } from '@plitzi/sdk-schema';
import { generateCache } from '@plitzi/sdk-style';

import { applyOperations } from './apply/dispatch';
import { operations } from './operations';
import { emptySpace } from '../helpers';
import { RENDER_APP_URI } from '../resources/renderApp';
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
    'Show the user a real, rendered UI widget instead of describing one — cards, hero sections, pricing tables, ' +
    'forms, menus, checklists, profiles, galleries. It runs the Plitzi SDK fully offline: no backend, account, or ' +
    'setup. Reach for it whenever a visual layout beats prose: the user asks you to design/build/show something, ' +
    'OR your answer is naturally visual (a recipe → a card, a comparison → a table, steps → a checklist). Prefer ' +
    'showing over telling.\n\n' +
    'Author the widget as an ordered list of `operations` that build an element tree under the pre-seeded root ' +
    'page "render". Three rules:\n' +
    '1. STRUCTURE — one upsertElement builds the whole tree: set pageRef:"render" and give element a nested ' +
    '`children` array. Each element is { ref (unique), type, subType?, props?, style?, children? }; children render ' +
    'in order. (To attach to something you already made, use a top-level parentRef:"<existing ref>" instead.)\n' +
    '2. STYLE — declare reusable classes with upsertDefinition { ref, desktop:{ …CSS props in kebab-case… } }, then ' +
    'attach via the element style:{ base:["<class ref>"] }. Lay containers out with flex/grid.\n' +
    '3. CONTENT — visible copy goes in props.content (text, heading, paragraph, button); heading level is the ' +
    'element subType ("h1".."h6"); image/video take props.src. An unknown prop comes back as a warning naming the ' +
    'right one.\n\n' +
    'Common types: container, heading, paragraph, text, button, link, image, video, list, listItem, markdown ' +
    '(plitzi://render/types lists every built-in type with descriptions).\n' +
    'READ the resource plitzi://render/guide first — it has the element/prop table, the style model and a full ' +
    'worked example, and following it is the difference between a widget that renders and repeated failed calls.\n' +
    'Returns a compact summary (the widget is shown to the user); on failure it returns teachable errors ' +
    '(path + hint) — read them and retry.',
  inputShape: renderShape,
  access: 'read',
  spaceless: true,
  ui: { resourceUri: RENDER_APP_URI },
  run: input => toRenderResult(render(input))
});
