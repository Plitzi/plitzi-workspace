import { z } from 'zod';

import { actionAccess, actionField, actionLimits, actionNode, actionTriggerParams } from './actions/document';
import { connectorConnection, readEndpoint, writeEndpoint } from './connectors/manifest';
import {
  bindingInput,
  elementAnchor,
  elementFlag,
  elementInput,
  elementMotion,
  elementQuiet,
  initialStateInput,
  interactionNode,
  position,
  ruleGroup,
  styleRefs,
  styleVariantInput
} from './schema/shared';
import {
  ancestors,
  ancestorsPatch,
  conditions,
  conditionsPatch,
  cssMap,
  cssPatchMap,
  definitionSlot,
  definitionSlotPatch,
  displayModeCss,
  displayModeCssPatch,
  pseudos,
  pseudosPatch,
  themeValue,
  variantPart,
  variantPartPatch
} from './style/shared';

/** The op union is the tool input of plitzi_apply (and of plitzi_render where apply is not listed), and every host
 *  reads it as JSON Schema on tools/list — on EVERY request of every conversation the server is connected to. It
 *  measured ~25k tokens a copy, which dwarfs anything a widget payload ever costs; one copy per connection is what
 *  `compactInputShape` keeps it to, and this keeps that copy small.
 *
 *  Most of that weight is one subschema pasted over and over: an element tree appears in upsertElement,
 *  patchElement and both repeat templates; a breakpoint CSS block in every style op; a rule group in every binding
 *  and interaction step. Zod emits a named `definitions` entry (and `$ref`s to it) for any schema carrying an `id`
 *  in the global registry, so registering the shared ones here collapses those copies — without touching the ops,
 *  the tools, or the MCP SDK, whose own converter honours the registry (it is given no options otherwise).
 *
 *  An id only pays when the schema is REUSED: giving one to a subschema that appears once makes the listing bigger,
 *  because the `definitions` entry and the ref cost more than the single copy they replace (measured, and reverted).
 *
 *  The ids are the names the MODEL reads in the refs, so they are written for it: `Element`, not `ElementInput`.
 *  This runs once, at module load of the op vocabulary, so every conversion path benefits. */
const SHARED_SCHEMAS: [z.ZodType, string][] = [
  [elementInput, 'Element'],
  // In every element, a page and a patch: pasted, its description is the size of a small op.
  [elementFlag, 'ElementFlag'],
  // In an element and a patch, once per tool that carries the op union.
  [elementAnchor, 'ElementAnchor'],
  // The same: an element and a patch, in every tool with the op union.
  [elementMotion, 'ElementMotion'],
  [elementQuiet, 'ElementQuiet'],
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
  [ancestors, 'StyleAncestors'],
  [ancestorsPatch, 'StyleAncestorsPatch'],
  // A class's pseudo-elements, its conditions and its variants (which hold pseudo-elements of their own): in every
  // style op, its slots and its patch — inlined, they took the listing from 0.2 MB to 0.33 MB.
  [pseudos, 'StylePseudos'],
  [pseudosPatch, 'StylePseudosPatch'],
  [conditions, 'StyleConditions'],
  [conditionsPatch, 'StyleConditionsPatch'],
  [variantPart, 'StyleVariantRules'],
  [variantPartPatch, 'StyleVariantRulesPatch'],
  [themeValue, 'ThemeValue'],
  // The connector manifest is the heaviest shape in the union — its endpoints and connection settings appear in
  // both upsertConnector and patchConnector, so without these three ids the listing carries each of them twice per
  // tool (measured at ~6k of extra JSON per tool, four tools over).
  [readEndpoint, 'ConnectorRead'],
  [writeEndpoint, 'ConnectorWrite'],
  [connectorConnection, 'ConnectorConnection'],
  // The action document is the same story: its access rule, its trigger union, its field shape and its step shape
  // appear in both upsertAction and patchAction, so without these ids the listing carries each of them twice per
  // tool — and the trigger union alone is large enough to push the whole listing past its budget (it did).
  [actionAccess, 'ActionAccess'],
  [actionTriggerParams, 'ActionTriggerParams'],
  [actionField, 'ActionField'],
  [actionNode, 'ActionStep'],
  [actionLimits, 'ActionLimits']
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
