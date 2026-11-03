import { PLUGIN_CSS_LAYER, RUNTIME_CSS_LAYER } from './cssLayers';

/**
 * The space's compiled stylesheet (`style.cache`) on a server-rendered page: linked, not carried.
 *
 * It is the whole space's — every page's rules — and on a large one most of the page: the dashboard's 429 KB of a
 * 496 KB document. Inline, every response compressed it again and every page load parsed it again with the HTML; a
 * file of its own is compressed once, kept by the browser for good under its name, and the page carries what is this
 * request's alone — the variables, the custom CSS — beside a `<link>` to it.
 *
 * It travels as a file only when its text is the same for every visitor of that version of the space: a `{{ token }}`
 * in it is replaced by the variables as THIS request resolves them (its route, its host), so a cache holding one stays
 * inline, as does any page the server could not answer the file for (a draft, a space named by a token).
 */

/** The `data-id` of the stylesheet the SDK renders into the page. */
export const RUNTIME_STYLE_ID = 'plitzi-runtime-style';

/** The `id` of the `<link>` a server-rendered page's head loads the stylesheet with. */
export const STYLE_SHEET_ID = 'plitzi-style';

/** Where a space's stylesheet is served from: `/_plitzi/style/<hash>.css`, on the page's own host. */
export const STYLE_SHEET_PATH = '/_plitzi/style/';

/** The address of the stylesheet named `hash`. */
export const styleSheetHref = (hash: string): string => `${STYLE_SHEET_PATH}${hash}.css`;

/** Whether the cache reads the same for every request, and so can be a file of its own. */
export const styleSheetLinkable = (cache: string): boolean => cache !== '' && !cache.includes('{{');

/**
 * The stylesheet's text: the cache in the runtime layer, with the layers' order said first — the file may be the first
 * thing on the page to name them, and a plugin's stylesheet arriving later would otherwise take a layer above it.
 */
export const styleSheetCss = (cache: string): string =>
  `@layer ${PLUGIN_CSS_LAYER}, ${RUNTIME_CSS_LAYER};@layer ${RUNTIME_CSS_LAYER}{${cache}}`;
