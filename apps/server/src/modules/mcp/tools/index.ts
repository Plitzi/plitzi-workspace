import { applyTool } from './apply';
import { readTool } from './read';
import { searchTool } from './search';
import { validateTool } from './validate';

import type { ToolDef } from './shared/tool';

export { apply, applyShape } from './apply';
export { validate, validateShape } from './validate';
export { search, searchShape } from './search';
export { read, readShape } from './read';
export { applyOperations } from './apply/dispatch';
export { validateOperations } from './shared/validator';
export { operation } from './shared/operations';

/** The MCP tool registry — the single source both hosts (the standalone server and the in-process AI bridge)
 *  register from. Adding a tool is: create its file with a ToolDef descriptor and append it here. */
export const tools: ToolDef[] = [applyTool, validateTool, searchTool, readTool];

export type { ToolContext, ToolDef } from './shared/tool';
export type { OpResult } from '../helpers';
export type {
  DefinitionSlotInput,
  DefinitionSlotPatch,
  ElementInput,
  Operation,
  OperationType
} from './shared/operations';
export type {
  ApplyInput,
  ChangedResource,
  Conflict,
  Persisters,
  WriteElement,
  WriteResponse,
  ValidateInput,
  ValidationResult,
  MutationOutcome,
  SearchHit,
  SearchInput,
  SearchResponse,
  SearchPageHit,
  ReadInput,
  ReadResponse,
  ReadHit
} from '../types';
