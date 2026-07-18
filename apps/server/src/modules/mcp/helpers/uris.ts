import type { Env } from '../types';

// Single source of truth for every plitzi:// resource URI: the builders below, the family list the canonical/alias
// logic reads, and the small `afterPrefix` parser the resolvers use. Nothing else in the module hand-writes a
// plitzi:// string — a scheme change lands here and nowhere else.

// --- Space-independent resources (no env, public) ---
export const guideUri = 'plitzi://guide';
export const typesUri = 'plitzi://types';
export const cssPropertiesUri = 'plitzi://css-properties';

// --- Cold-start bundle ---
export const primerUri = (env: Env): string => `plitzi://primer/${env}`;

// --- Element schema ---
export const pagesUri = (env: Env): string => `plitzi://schema/${env}/pages`;
export const pageUri = (env: Env, ref: string): string => `plitzi://schema/${env}/pages/${ref}`;
export const pageStylesUri = (env: Env, ref: string): string => `${pageUri(env, ref)}/styles`;
export const elementUri = (env: Env, ref: string): string => `plitzi://schema/${env}/elements/${ref}`;
export const schemaVarsUri = (env: Env): string => `plitzi://schema-variables/${env}`;
export const settingsUri = (env: Env): string => `plitzi://settings/${env}`;
export const interactionsUri = (env: Env): string => `plitzi://interactions/${env}`;
export const dataSourcesUri = (env: Env): string => `plitzi://data-sources/${env}`;

// --- Folders ---
export const foldersUri = (env: Env): string => `plitzi://folders/${env}`;
export const folderUri = (env: Env, ref: string): string => `plitzi://folders/${env}/${ref}`;

// --- Style ---
export const defsUri = (env: Env): string => `plitzi://definitions/${env}`;
export const defUri = (env: Env, ref: string): string => `plitzi://definitions/${env}/${ref}`;
export const globalsUri = (env: Env): string => `plitzi://global-styles/${env}`;
export const globalUri = (env: Env, componentType: string): string => `plitzi://global-styles/${env}/${componentType}`;
export const idsUri = (env: Env): string => `plitzi://id-styles/${env}`;
export const idUri = (env: Env, targetId: string): string => `plitzi://id-styles/${env}/${targetId}`;
export const styleVarsUri = (env: Env): string => `plitzi://style-variables/${env}`;
export const styleVarUri = (env: Env, category: string): string => `plitzi://style-variables/${env}/${category}`;

// The style / schema-variable / folder families also answer under a plitzi://schema/{env}/… alias (RFC 0005 I3);
// the canonical resolver folds those back to these roots.
export const aliasedRoots = [
  'definitions',
  'global-styles',
  'id-styles',
  'style-variables',
  'schema-variables',
  'folders'
];

// Every templated item URI (a ref-bearing shape), so a resolver can tell a well-formed-but-unresolved URI from a
// malformed one. Built from the same builders, with the template placeholder passed as the ref.
export const itemTemplates = (env: Env): string[] => [
  pageUri(env, '{ref}'),
  elementUri(env, '{ref}'),
  defUri(env, '{ref}'),
  globalUri(env, '{componentType}'),
  idUri(env, '{targetId}'),
  styleVarUri(env, '{category}'),
  folderUri(env, '{ref}')
];

/** The remainder of `uri` after `prefix`, or undefined when it does not start with it — so a resolver matches a
 *  family and extracts its ref in one step, without repeating the prefix string for both the startsWith and slice. */
export const afterPrefix = (uri: string, prefix: string): string | undefined =>
  uri.startsWith(prefix) ? uri.slice(prefix.length) : undefined;
