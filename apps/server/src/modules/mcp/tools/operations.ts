import { z } from 'zod';

import { elementOps } from './schema/operations';
import { styleOps } from './style/operations';

export type { ElementInput } from './schema/operations';
export type { DefinitionSlotInput, DefinitionSlotPatch } from './style/operations';

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

const environment = z.string().optional().describe('Environment; default main');
const operations = z.array(operation).max(100).describe('Operations applied atomically, in order (max 100)');

export const applyShape = {
  environment,
  dryRun: z
    .boolean()
    .optional()
    .describe(
      'Validate and apply in memory only, WITHOUT persisting. Returns the same result (changed versions + full ' +
        'element detail) so you can inspect the outcome and decide on more changes before committing for real.'
    ),
  expectedResourceVersions: z
    .record(z.string(), z.string())
    .optional()
    .describe('Resource URI → the stateVersion you read; guards against concurrent edits'),
  operations
};

export const validateShape = { environment, operations };

export const searchShape = {
  query: z.string().describe('Case-insensitive match on label, type and attribute values'),
  filters: z.object({ type: z.string().optional(), pageRef: z.string().optional() }).optional(),
  include: z
    .literal('detail')
    .optional()
    .describe('Set to "detail" to inline each hit\'s full props/style so an edit needs no follow-up read')
};
