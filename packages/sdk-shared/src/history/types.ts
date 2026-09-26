/** Which of a space's two documents a change was made to. */
export type ChangeDocument = 'schema' | 'style';

/**
 * Where a change came from: a person in the builder, an agent over MCP, the builder's co-worker, the autofix, a GraphQL
 * client that is not a person, or a writer with nothing to say (a seed, a script).
 */
export type ChangeOrigin = 'builder' | 'mcp' | 'coworker' | 'autofix' | 'api' | 'system';

/**
 * What one entry is about. Schema: an element (pages and layouts are elements too), a page folder, a schema variable,
 * a setting (`settings.<key>`, `definition.<key>`, the page order `pages`). Style: a class selector, a global style
 * (a bare element selector), an id style, a design token (`<category>/<name>`), a font family, a style setting
 * (`theme`, `mode`).
 */
export type ChangeKind =
  'element' | 'folder' | 'variable' | 'setting' | 'selector' | 'globalStyle' | 'idStyle' | 'token' | 'font';

/** One entity that changed, whole, before and after: the field-level difference is derived from the two. */
export type ChangeEntry = {
  kind: ChangeKind;
  id: string;
  op: 'add' | 'remove' | 'update';
  /** Absent on `add`. */
  before?: unknown;
  /** Absent on `remove`. */
  after?: unknown;
};

export type ChangeAuthor = { userId: number | null; name: string };

/** One save that changed something: who, from where, and every entity it touched. */
export type SpaceChange = {
  spaceId: number;
  environment: string;
  /** Monotonic per space and environment: the timeline's order and the address of a point in it. */
  seq: number;
  /** Milliseconds. */
  at: number;
  document: ChangeDocument;
  author: ChangeAuthor;
  origin: ChangeOrigin;
  /** The MCP client's name, or the builder tab's instance id. */
  client?: string;
  /** Everything one request wrote shares it: one builder request, one `plitzi_apply`, one autofix. */
  batch: string;
  entries: ChangeEntry[];
  summary: string;
  /** The entries name what changed but carry no values: the whole change was too large to store as one record. */
  truncated?: boolean;
};
