import { applyTool } from './apply';
import { describeOperationTool } from './describeOperation';
import { addPageTool, bindTool, classTool, placeTool, setTool } from './intents';
import { previewTool } from './preview';
import { readTool } from './read';
import { renderTool } from './render';
import { screenshotTool } from './screenshot';
import { searchTool } from './search';
import { tryFunctionTool } from './tryFunction';

import type { ToolDef } from './shared/tool';

export { apply, applyShape } from './apply';
export { search, searchShape } from './search';
export { read, readShape } from './read';
export { validateOperations } from './shared/validator';
export { operation } from './operations';

/** The MCP tool registry — the single source the server registers from. Adding a tool is: create its file with a
 *  ToolDef descriptor and append it here. */
export const tools: ToolDef[] = [
  applyTool,
  setTool,
  classTool,
  bindTool,
  placeTool,
  addPageTool,
  searchTool,
  describeOperationTool,
  readTool,
  renderTool,
  previewTool,
  screenshotTool,
  tryFunctionTool
];

export type { ToolContext, ToolDef } from './shared/tool';
export type { OpResult } from '../helpers';
export type { DefinitionSlotInput, DefinitionSlotPatch, ElementInput, Operation, OperationType } from './operations';
export type {
  ApplyInput,
  ChangedResource,
  Conflict,
  Persisters,
  WriteElement,
  WriteResponse,
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
