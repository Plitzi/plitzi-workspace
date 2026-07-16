import { z } from 'zod';

import { elementOps } from './schema';
import { styleOps } from './style';

export type { ElementInput } from './schema';
export type { DefinitionSlotInput, DefinitionSlotPatch } from './style';

// The write vocabulary across both schemas — single source of truth for the tool input schema (compact, sent
// to the agent), for runtime parsing, and for the `Operation` type. A single batch may mix element and style
// ops (e.g. rename an element AND make it red) — applied atomically across both schemas.
export const operation = z.discriminatedUnion('type', [
  elementOps.upsertElement,
  elementOps.patchElement,
  elementOps.deleteElement,
  elementOps.moveElement,
  elementOps.upsertPage,
  elementOps.deletePage,
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
  styleOps.upsertDefinition,
  styleOps.patchDefinition,
  styleOps.deleteDefinition,
  styleOps.upsertGlobalStyle,
  styleOps.patchGlobalStyle,
  styleOps.deleteGlobalStyle,
  styleOps.upsertStyleVariable,
  styleOps.deleteStyleVariable
]);

export type Operation = z.infer<typeof operation>;
export type OperationType = Operation['type'];

// The style-op type names are exactly the keys of styleOps, so adding a style op needs no change here.
const STYLE_OP_TYPES = new Set<string>(Object.keys(styleOps));

export const isStyleOp = (type: OperationType): boolean => STYLE_OP_TYPES.has(type);

// Shared input fragments for the batch tools (apply / validate), which co-locate their own full shapes.
export const environment = z.string().optional().describe('Environment; default main');
export const operations = z.array(operation).max(100).describe('Operations applied atomically, in order (max 100)');
