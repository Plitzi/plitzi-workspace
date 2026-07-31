import { z } from 'zod';

import { validateSchema } from '@plitzi/sdk-schema/helpers/schemaValidator';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { applyOperations } from './apply/dispatch';
import { operations } from './operations';
import { RENDER_APP_URI } from '../apps';
import { emptySpace } from '../helpers';
import { expandOperations } from './shared/expandOperations';
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
  operations,
  patch: z
    .boolean()
    .optional()
    .describe(
      'Set true to CHANGE a widget you already rendered instead of rebuilding it: send its `renderId` and ONLY ' +
        'the operations that differ (patchDefinition, patchElement, deleteElement, a new repeatElement…). The ' +
        'widget merges them into the batch it was built from and reports back what it applied. The refs it ' +
        'already has (card-1, blk-2-3) are the ones to address. If that widget cannot be recovered — a surface ' +
        'that renders none, a host that keeps no storage — the answer says so and you re-send the whole batch.'
    ),
  renderId: z
    .string()
    .optional()
    .describe('Handle returned by a previous render. Required with patch:true; it names the widget being changed.')
};

export type RenderInput = { operations: Operation[]; patch?: boolean; renderId?: string };

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
      warnings?: string[];
    };

// Build a self-contained render payload from agent-authored operations, WITHOUT any space or cloud. The ops are
// applied to a throwaway seed space (one host page) using the exact same validate → apply → integrity → audit
// pipeline as plitzi_apply, then the style cache is compiled and the result returned as OfflineDataRaw — the SDK's
// offline render input. The agent authors the widget by targeting `pageRef: "render"`.
export const render = (input: RenderInput): RenderResponse => {
  const space = seedSpace();

  const expansion = expandOperations(input.operations);
  if (expansion.errors.length > 0) {
    return { rendered: false, errors: expansion.errors };
  }

  const ops = expansion.operations;
  const validation = validateOperations(space, ops);
  if (!validation.valid) {
    return { rendered: false, errors: validation.errors, warnings: noWarnings(validation.warnings) };
  }

  const outcome = applyOperations(space, 'main', ops);
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

  const audit = auditResources(space, ops);
  const warnings = [...validation.warnings, ...audit.warnings];
  if (audit.errors.length > 0) {
    return { rendered: false, errors: audit.errors, warnings: noWarnings(warnings) };
  }

  // Compile the global style cache from the per-item caches the style ops just wrote — the offline SDK reads
  // Style.cache, so it must be concatenated here just as persisting a real space would.
  space.style.cache = generateCache(space.style);

  return {
    rendered: true,
    operations: ops,
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
/** A patch is not rendered here — it CANNOT be: this server keeps nothing between calls (no session, no store,
 *  any replica answers any request), so the previous widget only exists on the host side. The delta therefore
 *  travels as a courier result: the model pays for the delta alone, the view recovers the batch that widget was
 *  built from (by renderId — see apps/render/heldBatch.ts), merges, and re-calls this same tool with the whole
 *  thing over the host bridge, never through the model's context, then reports back with ui/update-model-context.
 *
 *  The renderId is the explicit handle the MCP RC asks for in place of implicit session state: the model carries
 *  it, so a patch names the widget it means and any replica can serve it.
 *
 *  Validation is not skipped, only deferred: the re-call carries the full batch, so refs, integrity and the audit
 *  all run exactly as they do on a first render, and their errors reach the model through that report. */
const toPatchResult = (ops: Operation[], renderId: string | undefined): CallToolResult => {
  // A patch is the one call whose emptiness is never intentional: it would travel to the view, merge nothing and
  // re-render the same widget — a silent round trip the model would read as success. Said plainly instead.
  if (ops.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            patch: false,
            error: 'A patch carries no operations',
            hint: 'Send the operations that differ from the widget on screen, or drop `patch` to render a new one.'
          })
        }
      ]
    };
  }

  if (renderId === undefined) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            patch: false,
            error: 'A patch needs the renderId of the widget it changes',
            hint: 'Pass the renderId the render answered with, or drop `patch` to render a new widget.'
          })
        }
      ]
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          patch: true,
          renderId,
          operations: ops.length,
          note: 'Handed to the widget; it will report what it applied. If nothing reports back, it could not be recovered — re-send the full batch without patch.'
        })
      }
    ],
    structuredContent: { patch: true, renderId, operations: ops }
  };
};

// The handle the model carries between calls. Random per render (any replica can mint one, none has to remember
// it) and short, because the model pays for it in every patch it sends.
const newRenderId = (): string => `r${Math.random().toString(36).slice(2, 8)}`;

const toRenderResult = (res: RenderResponse, renderId: string): CallToolResult => {
  if (!res.rendered) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ rendered: false, errors: res.errors, warnings: res.warnings }) }]
    };
  }

  const summary = {
    rendered: true,
    renderId,
    rootRef: res.rootRef,
    elementCount: res.elementCount,
    warnings: res.warnings
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(summary) }],
    // `operations` rides along for the view, not the model: it is what a later patch gets merged into. It never
    // reaches the model (structuredContent is delivered to the renderer), so echoing it costs no tokens.
    structuredContent: { ...summary, offlineData: res.offlineData, operations: res.operations }
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
    '1b. REPEATS — the moment two siblings share a shape and differ only in data (list, steps, cards, table, ' +
    'timeline), do NOT copy-paste them: use repeatElement { pageRef, ref (wrapper), style, template, items }. The ' +
    'template is written once with {{item.field}} placeholders and rendered per row; refs come out numbered ' +
    '("step-1", "step-2"…). A list INSIDE each row (days with their own steps) is the same op: give the wrapping ' +
    'node repeat:{ items:"{{item.<list>}}", template:… } and put the sub-rows in the row data.\n' +
    '2. STYLE — declare ALL the classes in ONE upsertDefinitions { definitions: { "<class>": { desktop:{ …CSS in ' +
    'kebab-case… } }, … } }, then attach via the element style:{ base:["<class ref>"] }. Lay containers out with ' +
    'flex/grid. Keep the call small: one class per look (not per property), and never hand-draw a scene in a ' +
    'data: URI — it costs more than the whole widget; use an https image, a flat colour or a gradient.\n' +
    '2b. LAYOUT — it renders in a side panel, so width is free and HEIGHT is scarce. Plain containers stack ' +
    'children vertically, which is the tall half-empty default to avoid: put peers (metrics, plans, options, ' +
    'image + text) in a wrapping row — display:flex, flex-direction:row, flex-wrap:wrap, children flex-grow:"1" + ' +
    'flex-basis:"0%" + min-width — or a grid with grid-template-columns:"repeat(auto-fit, minmax(160px, 1fr))". ' +
    'Keep padding 12-16px and gap 8-12px, and let the outer container fill the panel. Stack only what reads in ' +
    'order (heading over paragraph, forms, steps, prose). Watch the SDK defaults: every container has ' +
    'min-width/min-height 50px (set them to "0" for rails, dividers, dots and any flex child that must shrink), ' +
    'and heading/paragraph keep the margins the browser gives them (zero them, space with the parent gap).\n' +
    '2c. THEME — it is embedded in the host UI, which MAY BE DARK, so never hardcode a light palette. Take colours ' +
    'from the host variables with a light-dark() fallback — background-color:"var(--color-background-secondary, ' +
    'light-dark(#ffffff, #1f2430))", color:"var(--color-text-primary, light-dark(#0f172a, #e8eaed))", ' +
    'border-color:"var(--color-border-primary, light-dark(#e2e8f0, #333a48))" — and always set `color` wherever ' +
    'you set `background-color` (a brand accent states its own text colour too).\n' +
    '3. CONTENT — visible copy goes in props.content (text, heading, paragraph, button); heading level is the ' +
    'element subType ("h1".."h6"); image/video take props.src. An unknown prop comes back as a warning naming the ' +
    'right one.\n\n' +
    'Common types: container, heading, paragraph, text, button, link, image, video, list, listItem, markdown ' +
    '(plitzi://render/types lists every built-in type with descriptions). Widgets can also be data-driven and ' +
    'interactive — an apiContainer fetches at runtime, upsertBinding wires data into elements, and ' +
    'upsertInteractionFlow makes them react to clicks (see the guide).\n' +
    'READ the resource plitzi://render/guide first — it has the element/prop table, the style model and a full ' +
    'worked example, and following it is the difference between a widget that renders and repeated failed calls.\n' +
    'ITERATING — to change a widget you already rendered, do NOT rebuild it: call again with patch:true, the ' +
    '`renderId` that render answered with, and ONLY the operations that differ (patchDefinition, patchElement, ' +
    'deleteElement…). The widget merges them and reports back what it applied; address rows by the refs you ' +
    'already know. Patch ONLY to modify that widget: a different subject or a different kind of widget is a fresh ' +
    'render, without patch — a patch is merged into the previous batch, so patching a new idea leaves you with ' +
    'both.\n' +
    'Returns a compact summary including the renderId (the widget itself is shown to the user); on failure it ' +
    'returns teachable errors (path + hint) — read them and retry.',
  inputShape: renderShape,
  access: 'read',
  spaceless: true,
  ui: { resourceUri: RENDER_APP_URI },
  run: input =>
    input.patch === true
      ? toPatchResult(input.operations, input.renderId)
      : // The view re-calls a merged patch WITH the id it already holds, so the widget keeps one handle across
        // every iteration; a first render mints one.
        toRenderResult(render(input), input.renderId ?? newRenderId())
});
