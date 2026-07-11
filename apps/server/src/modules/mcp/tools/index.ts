import { applyTool } from './apply';
import { readTool } from './read';
import { searchTool } from './search';
import { validateTool } from './validate';

import type { ToolDef } from './tool';

export { apply, applyShape } from './apply';
export { validate, validateShape } from './validate';
export { search, searchShape } from './search';
export { read, readShape } from './read';
export { applyOperations } from './dispatch';
export { validateOperations } from './validator';
export { operation } from './operations';

/** The MCP tool registry — the single source both hosts (the standalone server and the in-process AI bridge)
 *  register from. Adding a tool is: create its file with a ToolDef descriptor and append it here. */
export const tools: ToolDef[] = [applyTool, validateTool, searchTool, readTool];

export type { ToolContext, ToolDef } from './tool';
export type { OpResult } from '../helpers';
export type { DefinitionSlotInput, DefinitionSlotPatch, ElementInput, Operation, OperationType } from './operations';
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
