import { BUILTIN_ELEMENT_CALLBACKS, BUILTIN_GLOBAL_CALLBACKS, BUILTIN_UTILITIES } from '../catalogs';

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
  'style.base is a LIST — an element can attach several classes (plus non-base slots); ALL of them apply together',
  '(they cascade), so when a style looks wrong inspect EVERY attached class + its global/id styles, not just one.',
  'Refs accept a semantic idRef ([A-Za-z0-9_-] starting with a letter, unique, chosen by you) or the raw id; the',
  'idRef is ALSO the runtime wiring key (a provider source is `<type>_<idRef>.<field>` — a dot is not allowed in the',
  'idRef, an underscore is). CSS is kebab-case; style vars are var(--name), schema',
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

const NAVIGATION = [
  '━━ NAVIGATION & DYNAMIC PAGES ━━',
  'To move between pages, PREFER the Link element over an interaction — it is a CONTAINER that wraps any children and',
  'navigates on click. mode "page" links to another space page (href = the target page); mode "internal" takes a',
  'path inside the space and resolves {{token}} templates in it (e.g. /posts/{{postId}}); mode "external" is a full',
  'URL. Reach for the navigate globalCallback only when navigation must be one step inside a larger flow.',
  'A page slug is RELATIVE — never start it with "/" (the runtime prepends it). Folder slugs PREPEND to the page',
  'slug, so a page at slug "post" inside folders "blog" > "2024" resolves to /blog/2024/post.',
  'A slug segment ":name" (e.g. "posts/:postId") declares a ROUTE PARAM, react-router style. It is readable on that',
  'page as {{name}} in props AND as the binding source navigation.routeParams.name — so a dynamic detail page is a',
  '"posts/:postId" page whose apiContainer query binds navigation.routeParams.postId.'
].join('\n');

// One line per built-in action (its exact param names), generated from the catalogs so the guidance is always the
// truth — the class of drift that let an agent invent title/message on addNotification or `delay` on delayTime.
const paramList = (params: Record<string, unknown>): string => {
  const names = Object.keys(params);

  return names.length > 0 ? names.join(', ') : '(no params)';
};

const globalCallbackLines = (): string[] =>
  Object.entries(BUILTIN_GLOBAL_CALLBACKS).map(
    ([action, { source, params }]) => `  • ${action} → source "${source}"; params: ${paramList(params)}`
  );

const elementCallbackLines = (): string[] =>
  Object.entries(BUILTIN_ELEMENT_CALLBACKS).map(
    ([action, { params }]) => `  • ${action}; params: ${paramList(params)}`
  );

const utilityLines = (): string[] =>
  Object.entries(BUILTIN_UTILITIES).map(([action, { params }]) => `  • ${action}; params: ${paramList(params)}`);

const INTERACTIONS = (): string =>
  [
    '━━ INTERACTIONS ━━',
    'A flow is a trigger (onClick, onPageLoad…) followed by ordered callbacks/utilities; each step has an enabled',
    'flag. Write one with upsertInteractionFlow (first node MUST be a trigger); change one step with',
    'patchInteractionNode; remove a step (nodeId) or a whole flow (flowId) with deleteInteraction.',
    'Disable ≠ delete: to turn a step off without removing it use patchInteractionNode { enabled: false }.',
    'deleteInteraction is destructive — confirm with the user first.',
    'Pick the RIGHT node type for an action: the wrong type resolves against nothing and the step silently no-ops.',
    'Any param VALUE can be a data-binding token {{ source }} — e.g. addNotification content',
    '"{{ list_<idRef>.item.name }}" shows the clicked row’s field; it resolves at runtime just like a prop binding.',
    '',
    'globalCallback (nodeType "globalCallback") — provided by a SOURCE MODULE, not the host element: OMIT elementId',
    'and the MCP pins the right source and fills the builder’s param defaults. Use ONLY each callback’s declared',
    'params (exact spelling) — for addNotification the text goes in `content` (NO title/message/type). Built-ins:',
    ...globalCallbackLines(),
    '',
    'callback (nodeType "callback") — a callback ON an element; elementId is that element (host by default). Every',
    'element has a built-in `setState` that changes ITS OWN attribute/state (category/key/value/revertOnFinish). Set',
    'revertOnFinish:true for a TEMPORARY change (e.g. a "loading…" label) so it auto-reverts at flow end — do NOT add',
    'manual restore steps. This element setState has NO `type` param (that is the global state setState). Built-ins:',
    ...elementCallbackLines(),
    '',
    'utility (nodeType "utility") — no element/source. Use the EXACT param names (delayTime waits `time` ms, not',
    '`delay`). Built-ins:',
    ...utilityLines(),
    'The full param schema (types, options, defaults) for each is in plitzi://interactions/{env}.'
  ].join('\n');

/** The MCP-owned guidance block a consumer concatenates into its system prompt. Covers what the MCP is
 *  authoritative about: its editing model, tools, resources and interaction vocabulary. It intentionally does NOT
 *  cover a consumer’s own tools (previews, design helpers) or product framing (modes, identity, security). */
export const buildAgentGuide = (): string =>
  [EDITING_MODEL, '', TOOLS, '', RESOURCES, '', NAVIGATION, '', INTERACTIONS()].join('\n');
