import { BUILTIN_GLOBAL_CALLBACKS } from '../catalogs';

// MCP-OWNED agent guidance. A consumer (a co-worker system prompt) concatenates this so the MCP's own vocabulary —
// its tool names, its resource URIs, its interaction rules — lives in ONE place and cannot drift out of sync with
// what the server actually exposes. Product-specific framing (identity, plan/build modes, security, language, and
// the consumer's OWN tools like preview/design helpers) stays in the consumer.
//
// The interactions section is GENERATED from the built-in callback catalog, so adding/changing a globalCallback or
// its params updates this guidance automatically — the class of drift that let an agent invent title/message on
// addNotification instead of using `content`.

const EDITING_MODEL = [
  '━━ PLITZI MCP — EDITING MODEL ━━',
  'A Plitzi space is TWO schemas you edit together in one atomic plitzi_apply batch:',
  '• Element schema — the tree of pages/elements (type, label, props, and which style classes each uses).',
  '• Style schema — reusable definitions (CSS classes), design tokens (variables), theme.',
  'To style an element: write a definition AND attach it via the element’s style.base in the same batch.',
  'Refs accept a semantic idRef ([A-Za-z0-9-], unique, chosen by you) or the raw id; the idRef is ALSO the runtime',
  'wiring key (a provider source is `<type>_<idRef>.<field>`). CSS is kebab-case; style vars are var(--name), schema',
  'vars are {{name}}. Use patchElement/patchDefinition to change SOME props/CSS; the upsert variants replace them all.',
  'Reads are cheap by design — list to navigate, read one item for detail; never fetch a whole tree you do not need.'
].join('\n');

const TOOLS = [
  '━━ MCP TOOLS ━━',
  '• plitzi_search — find refs by label/type/attribute (include:"detail" also returns each hit’s style + versions).',
  '• plitzi_read — batch-read one or more resource URIs you already hold (from search or a write response).',
  '• plitzi_validate — check a batch of operations without executing; returns teachable errors and warnings.',
  '• plitzi_apply — persist a batch of operations. Pass dryRun to preview the full diff without writing, and',
  '  expectedResourceVersions to guard against concurrent edits (apply and search hand back the versions you need).',
  '• plitzi_preview / plitzi_screenshot — render an element/page already in the schema (HTML / image).',
  'Discover → browse resources. Find a ref → plitzi_search. Fetch known URIs → plitzi_read. Do not confuse them.'
].join('\n');

const RESOURCES = [
  '━━ MCP RESOURCES (read) ━━',
  'Read plitzi://primer/{env} FIRST — a cold-start bundle: guide + types + css-properties + page/definition/variable',
  'summaries in one call. Then, on demand:',
  '• plitzi://guide — full usage reference.',
  '• plitzi://types — element types observed in this space (props, slots, subTypes, label/description/category).',
  '• plitzi://css-properties — valid kebab-case CSS property keys.',
  '• plitzi://schema/{env}/pages , /{ref} — page summaries, then one page as a skeleton tree.',
  '• plitzi://folders/{env} — page folders (the sidebar tree).',
  '• plitzi://definitions/{env} , plitzi://style-variables/{env} — style classes and design tokens.',
  '• plitzi://interactions/{env} — interaction actions + built-in globalCallbacks with their source + param schema.',
  '• plitzi://data-sources/{env} — data-source paths and binding targets (vocabulary for upsertBinding).',
  '• plitzi://settings/{env} — space-level settings.'
].join('\n');

// One line per built-in globalCallback: its action, the source module it is registered on, and its exact param
// names. Generated from the catalog so it is always the truth.
const builtinCallbackLines = (): string[] =>
  Object.entries(BUILTIN_GLOBAL_CALLBACKS).map(([action, { source, params }]) => {
    const names = Object.keys(params);
    const paramList = names.length > 0 ? names.join(', ') : '(no params)';

    return `  • ${action} → source "${source}"; params: ${paramList}`;
  });

const INTERACTIONS = (): string =>
  [
    '━━ INTERACTIONS ━━',
    'A flow is a trigger (onClick, onPageLoad…) followed by ordered callbacks/utilities; each step has an enabled',
    'flag. Write one with upsertInteractionFlow (first node MUST be a trigger); change one step with',
    'patchInteractionNode; remove a step (nodeId) or a whole flow (flowId) with deleteInteraction.',
    'Disable ≠ delete: to turn a step off without removing it use patchInteractionNode { enabled: false }.',
    'deleteInteraction is destructive — confirm with the user first.',
    '',
    'globalCallback steps are provided by a SOURCE MODULE, not by the host element: OMIT elementId and the MCP pins',
    'the right source and fills the builder’s param defaults. Never point their elementId at the host element.',
    'Use ONLY each callback’s declared params, with the exact spelling shown — unknown keys are dropped. For',
    'addNotification the user-facing text goes in `content` (there is NO title/message/type param). Built-in',
    'globalCallbacks:',
    ...builtinCallbackLines(),
    'The full param schema (types, options, defaults) for each is in plitzi://interactions/{env}.'
  ].join('\n');

/** The MCP-owned guidance block a consumer concatenates into its system prompt. Covers what the MCP is
 *  authoritative about: its editing model, tools, resources and interaction vocabulary. It intentionally does NOT
 *  cover a consumer’s own tools (previews, design helpers) or product framing (modes, identity, security). */
export const buildAgentGuide = (): string => [EDITING_MODEL, '', TOOLS, '', RESOURCES, '', INTERACTIONS()].join('\n');
