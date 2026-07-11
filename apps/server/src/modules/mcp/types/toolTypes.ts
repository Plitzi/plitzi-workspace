import type { AIDefinition, AIElementDetail, ValidationError } from './aiSchema';
import type { Operation } from '../tools/shared/operations';
import type { Schema, Style } from '@plitzi/sdk-shared';

// I/O contracts for the MCP tools (apply / validate / search / read) and the write engine. The runtime logic
// lives under tools/; only the data shapes live here, so a tool file reads as just its behavior.

// --- Shared write result ---

/** The element schema and the style schema persist independently (Space model / Style model), so each has
 *  its own optional persister. When one is absent, that schema is applied in memory but reported unsaved. */
export interface Persisters {
  schema?: (schema: Schema) => Promise<void>;
  style?: (style: Style) => Promise<void>;
}

export interface Conflict {
  resourceUri: string;
  expectedVersion: string;
  currentVersion: string;
}

export interface ChangedResource {
  uri: string;
  stateVersion: string;
}

/** Full detail of a created/updated element, plus its own uri and stateVersion so a follow-up edit of the same
 *  element can guard with optimistic concurrency without an intermediate read. */
export type WriteElement = AIElementDetail & { uri: string; stateVersion: string };

/** Write result: what changed and the new versions, plus the full detail of every element created/updated (with
 *  its uri + stateVersion) so the caller has that context without a follow-up read. Other resources (pages,
 *  definitions, variables) still report only uri+version — re-read them if needed. */
export interface WriteResponse {
  applied: boolean;
  dryRun?: boolean;
  persisted?: boolean;
  summary: { created: number; updated: number; deleted: number };
  changed: ChangedResource[];
  elements?: WriteElement[];
  warnings?: string[];
  errors?: ValidationError[];
  conflict?: { message: string; conflicts: Conflict[] };
}

/** The outcome of applying a batch to the space in memory: counts, which schema(s) changed (so the caller can
 *  persist each independently), the invalidated resource URIs and the refs of the elements it created/updated. */
export interface MutationOutcome {
  created: number;
  updated: number;
  deleted: number;
  staleResources: string[];
  elementRefs: string[];
  errors: ValidationError[];
  changedSchema: boolean;
  changedStyle: boolean;
}

// --- plitzi_apply ---

export interface ApplyInput {
  environment?: string;
  dryRun?: boolean;
  expectedResourceVersions?: Record<string, string>;
  operations: Operation[];
}

// --- plitzi_validate ---

export interface ValidateInput {
  environment?: string;
  operations: Operation[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// --- plitzi_search ---

export interface SearchInput {
  query: string;
  filters?: { type?: string; pageRef?: string };
  /** 'detail' inlines each hit's full props/style so an edit needs no follow-up read. */
  include?: 'detail';
}

export interface SearchHit {
  pageRef: string;
  ref: string;
  uri: string;
  pageUri: string;
  stateVersion: string;
  parentRef?: string;
  /** Ancestor labels from the page down to and including this element. */
  path: string[];
  label: string;
  type: string;
  matches: string[];
  detail?: AIElementDetail;
}

export interface SearchPageHit {
  ref: string;
  uri: string;
  stateVersion: string;
  label: string;
  slug: string;
  matches: string[];
}

export interface SearchResponse {
  results: SearchHit[];
  total: number;
  /** Style definitions whose ref matches the query, with their full CSS — so finding a class by name closes the
   *  loop to its style without a separate read. Present only when at least one definition matches. */
  definitions?: AIDefinition[];
  /** Pages whose name or slug matches the query (element hits never include pages). Each carries the page uri +
   *  stateVersion, ready to open or edit. Present only when at least one page matches. */
  pages?: SearchPageHit[];
}

// --- plitzi_read ---

export interface ReadInput {
  uris: string[];
}

export interface ReadHit {
  uri: string;
  stateVersion?: string;
  data?: unknown;
  error?: string;
  message?: string;
  hint?: string;
}

export interface ReadResponse {
  results: ReadHit[];
}
