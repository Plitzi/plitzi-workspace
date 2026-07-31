import { z } from 'zod';

import {
  bindingInput,
  elementInput,
  initialStateInput,
  interactionNode,
  position,
  ruleGroup,
  styleRefs,
  styleVariantInput
} from './schema/shared';
import {
  cssMap,
  cssPatchMap,
  definitionSlot,
  definitionSlotPatch,
  displayModeCss,
  displayModeCssPatch,
  themeValue
} from './style/shared';

/** The op union is the tool input of plitzi_apply, plitzi_validate, plitzi_render AND plitzi_preview, and every
 *  host reads it as JSON Schema on tools/list — four copies of the same 30 operations in the model's context, on
 *  EVERY request of every conversation the server is connected to. It measured ~25k tokens PER TOOL (~100k in
 *  total), which dwarfs anything a widget payload ever costs.
 *
 *  Most of that weight is one subschema pasted over and over: an element tree appears in upsertElement,
 *  patchElement and both repeat templates; a breakpoint CSS block in every style op; a rule group in every binding
 *  and interaction step. Zod emits a named `definitions` entry (and `$ref`s to it) for any schema carrying an `id`
 *  in the global registry, so registering the shared ones here collapses those copies — without touching the ops,
 *  the tools, or the MCP SDK, whose own converter honours the registry (it is given no options otherwise).
 *
 *  The ids are the names the MODEL reads in the refs, so they are written for it: `Element`, not `ElementInput`.
 *  This runs once, at module load of the op vocabulary, so every conversion path benefits — the MCP tools list and
 *  the co-worker's own tool-schema converter alike. */
const SHARED_SCHEMAS: [z.ZodType, string][] = [
  [elementInput, 'Element'],
  [ruleGroup, 'RuleGroup'],
  [styleRefs, 'StyleRefs'],
  [initialStateInput, 'InitialState'],
  [styleVariantInput, 'StyleVariant'],
  [interactionNode, 'InteractionNode'],
  [bindingInput, 'Binding'],
  [position, 'Position'],
  [cssMap, 'Css'],
  [cssPatchMap, 'CssPatch'],
  [definitionSlot, 'StyleSlot'],
  [definitionSlotPatch, 'StyleSlotPatch'],
  [displayModeCss, 'BreakpointCss'],
  [displayModeCssPatch, 'BreakpointCssPatch'],
  [themeValue, 'ThemeValue']
];

// The registry is zod's PROCESS-WIDE singleton and its id namespace is shared with everything else running here.
// A duplicate id does not throw — the last writer wins — so an unrelated module registering its own `Element`
// would silently repoint our refs at its shape, and a host would read a schema that does not describe these ops.
// Taking a prefixed id instead of the pretty one is a loss the model can live with; being renamed is not.
export const claimSchemaId = (schema: z.ZodType, id: string): void => {
  const taken = (z.globalRegistry as unknown as { _idmap: Map<string, z.ZodType> })._idmap.get(id);
  if (taken !== undefined && taken !== schema) {
    z.globalRegistry.add(schema, { id: `Plitzi${id}` });

    return;
  }

  z.globalRegistry.add(schema, { id });
};

/** Idempotent: the module can be imported more than once in a test run, and a schema that already carries its id
 *  is left alone (re-adding the same one is harmless but pointless). Runs at module load, never per request — the
 *  MCP builds a server per request and this must not grow with them (pinned in the statelessness test). */
export const registerSharedSchemaIds = (): void => {
  for (const [schema, id] of SHARED_SCHEMAS) {
    if (z.globalRegistry.get(schema)?.id === undefined) {
      claimSchemaId(schema, id);
    }
  }
};
