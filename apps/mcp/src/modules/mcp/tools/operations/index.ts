import { z } from 'zod';

import { closest } from '@plitzi/sdk-authoring';

import { actionOps } from './actions';
import { closed, typeOf } from './closed';
import { connectorOps } from './connectors';
import { dataOps } from './data';
import { functionOps } from './functions';
import { elementOps } from './schema';
import { registerSharedSchemaIds } from './schemaIds';
import { styleOps } from './style';

export type { ElementInput } from './schema';
export type { DefinitionSlotInput, DefinitionSlotPatch } from './style';

// The write vocabulary across both schemas — single source of truth for the tool input schema (compact, sent
// to the agent), for runtime parsing, and for the `Operation` type. A single batch may mix element and style
// ops (e.g. rename an element AND make it red) — applied atomically across both schemas.
// Before the union is built: a shared subschema only collapses into a `definitions` entry if it carries its id by
// the time anything converts it. See schemaIds.ts — it is worth ~57k tokens per conversation.
registerSharedSchemaIds();

/** A batch's operations, each read by its `type` — and a type none of them has answered with the nearest one. */
const union = <Options extends readonly [z.ZodObject, ...z.ZodObject[]]>(options: Options) => {
  const types = options.map(typeOf);

  return z.discriminatedUnion('type', options, {
    error: issue => {
      const { input } = issue;
      const type = typeof input === 'object' && input !== null && 'type' in input ? String(input.type) : '';
      const nearest = closest(type, types);

      return type === ''
        ? 'An operation needs its `type`: plitzi_describe_operation lists every one'
        : `There is no "${type}" operation${nearest ? ` — did you mean "${nearest}"?` : ''}: plitzi_describe_operation lists every type`;
    }
  });
};

// The two schema DOCUMENTS (elements + style). Everything that describes what a page looks like, and the only
// vocabulary that means anything to a tool with no space behind it.
const documentOps = [
  closed(elementOps.upsertElement),
  closed(elementOps.repeatElement),
  closed(elementOps.patchElement),
  closed(elementOps.deleteElement),
  closed(elementOps.moveElement),
  closed(elementOps.upsertPage),
  closed(elementOps.deletePage),
  closed(elementOps.upsertLayout),
  closed(elementOps.deleteLayout),
  closed(elementOps.upsertFolder),
  closed(elementOps.deleteFolder),
  closed(elementOps.upsertVariable),
  closed(elementOps.deleteVariable),
  closed(elementOps.upsertFlag),
  closed(elementOps.deleteFlag),
  closed(elementOps.upsertBinding),
  closed(elementOps.patchBinding),
  closed(elementOps.deleteBinding),
  closed(elementOps.upsertInteractionFlow),
  closed(elementOps.patchInteractionNode),
  closed(elementOps.deleteInteraction),
  closed(elementOps.patchSettings),
  closed(elementOps.upsertComponent),
  closed(elementOps.deleteComponent),
  closed(styleOps.upsertDefinition),
  closed(styleOps.upsertDefinitions),
  closed(styleOps.patchDefinition),
  closed(styleOps.deleteDefinition),
  closed(styleOps.upsertGlobalStyle),
  closed(styleOps.patchGlobalStyle),
  closed(styleOps.deleteGlobalStyle),
  closed(styleOps.upsertIdStyle),
  closed(styleOps.patchIdStyle),
  closed(styleOps.deleteIdStyle),
  closed(styleOps.upsertStyleVariable),
  closed(styleOps.deleteStyleVariable),
  closed(styleOps.upsertFont),
  closed(styleOps.deleteFont)
] as const;

export const documentOperation = union(documentOps);

// The full write vocabulary: the two schemas plus the connector, action, functions and data stores, which are neither of them
// (their own rows, their own persisters). Only the tools that can actually reach those stores offer these.
export const operation = union([
  ...documentOps,
  closed(connectorOps.upsertConnector),
  closed(connectorOps.patchConnector),
  closed(connectorOps.deleteConnector),
  closed(actionOps.upsertAction),
  closed(actionOps.patchAction),
  closed(actionOps.deleteAction),
  closed(functionOps.upsertFunctionFile),
  closed(functionOps.deleteFunctionFile),
  closed(dataOps.upsertDataFile),
  closed(dataOps.deleteDataFile)
]);

export type Operation = z.infer<typeof operation>;
export type OperationType = Operation['type'];

// The style op type names are exactly the keys of that map, so adding one needs no change here.
const STYLE_OP_TYPES = new Set<string>(Object.keys(styleOps));

export const isStyleOp = (type: OperationType): boolean => STYLE_OP_TYPES.has(type);

// The maximum number of operations one apply/validate batch may carry — the single source of truth, enforced by
// the zod shape below (parse-time) and re-checked with a teachable message by the batch validator.
export const MAX_OPS = 1000;

// Shared input fragments for the batch tools (apply / validate), which co-locate their own full shapes.
export const environment = z.string().optional().describe('Environment; default main');
export const operations = z
  .array(operation)
  .max(MAX_OPS)
  .describe(`Operations applied atomically, in order (max ${MAX_OPS})`);

// For the tools with nothing behind them to persist a connector to — an offline widget (plitzi_render) and a
// throwaway preview clone. Offering a connector op there would advertise a write that silently goes nowhere, and
// it would also carry the manifest schemas into every one of those listings for nothing.
export const documentOperations = z
  .array(documentOperation)
  .max(MAX_OPS)
  .describe(`Operations applied atomically, in order (max ${MAX_OPS})`);

/** Every operation by its type — the closed vocabulary an agent picks from, and what `plitzi_describe_operation` reads. */
export const OPERATIONS_BY_TYPE: ReadonlyMap<string, z.ZodType> = new Map(
  operation.options.map(variant => [variant.shape.type.value, variant])
);

const DOCUMENT_OPERATION_TYPES = documentOperation.options.map(variant => variant.shape.type.value);

/**
 * `documentOperations` as advertised beside a tool that already carries the whole vocabulary (`plitzi_apply`): each
 * operation's type from the closed list, its fields left to the schema the agent already has. One copy of a ~14k-token
 * schema per connection instead of two; what runs is still parsed against the full one.
 */
export const compactDocumentOperations = z
  .array(z.looseObject({ type: z.enum(DOCUMENT_OPERATION_TYPES) }))
  .max(MAX_OPS)
  .describe(
    `Operations applied atomically, in order (max ${MAX_OPS}) — the document operations of plitzi_apply, with the same ` +
      'fields; plitzi_describe_operation gives any one of them'
  );
