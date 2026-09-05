import { z } from 'zod';

import { actionOps } from './actions';
import { connectorOps } from './connectors';
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

// The two schema DOCUMENTS (elements + style). Everything that describes what a page looks like, and the only
// vocabulary that means anything to a tool with no space behind it.
const documentOps = [
  elementOps.upsertElement,
  elementOps.repeatElement,
  elementOps.patchElement,
  elementOps.deleteElement,
  elementOps.moveElement,
  elementOps.upsertPage,
  elementOps.deletePage,
  elementOps.upsertLayout,
  elementOps.deleteLayout,
  elementOps.upsertFolder,
  elementOps.deleteFolder,
  elementOps.upsertVariable,
  elementOps.deleteVariable,
  elementOps.upsertBinding,
  elementOps.patchBinding,
  elementOps.deleteBinding,
  elementOps.upsertInteractionFlow,
  elementOps.patchInteractionNode,
  elementOps.deleteInteraction,
  elementOps.patchSettings,
  styleOps.upsertDefinition,
  styleOps.upsertDefinitions,
  styleOps.patchDefinition,
  styleOps.deleteDefinition,
  styleOps.upsertGlobalStyle,
  styleOps.patchGlobalStyle,
  styleOps.deleteGlobalStyle,
  styleOps.upsertIdStyle,
  styleOps.patchIdStyle,
  styleOps.deleteIdStyle,
  styleOps.upsertStyleVariable,
  styleOps.deleteStyleVariable
] as const;

export const documentOperation = z.discriminatedUnion('type', documentOps);

// The full write vocabulary: the two schemas plus the connector and action stores, which are neither of them
// (their own rows, their own persisters). Only the tools that can actually reach those stores offer these.
export const operation = z.discriminatedUnion('type', [
  ...documentOps,
  connectorOps.upsertConnector,
  connectorOps.patchConnector,
  connectorOps.deleteConnector,
  actionOps.upsertAction,
  actionOps.patchAction,
  actionOps.deleteAction
]);

export type Operation = z.infer<typeof operation>;
export type OperationType = Operation['type'];

// The style/connector/action op type names are exactly the keys of those maps, so adding an op needs no change here.
const STYLE_OP_TYPES = new Set<string>(Object.keys(styleOps));
const CONNECTOR_OP_TYPES = new Set<string>(Object.keys(connectorOps));
const ACTION_OP_TYPES = new Set<string>(Object.keys(actionOps));

export const isStyleOp = (type: OperationType): boolean => STYLE_OP_TYPES.has(type);

export const isConnectorOp = (type: OperationType): boolean => CONNECTOR_OP_TYPES.has(type);

export const isActionOp = (type: OperationType): boolean => ACTION_OP_TYPES.has(type);

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
