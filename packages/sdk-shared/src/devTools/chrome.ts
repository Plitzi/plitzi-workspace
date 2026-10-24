/**
 * The attribute every piece of the dev tools' own chrome carries — the badge, the panel — so whatever looks at the
 * page rather than at the tools can leave it out: `plitzi page shot` and `plitzi page check` hide it, and a picture of a page is
 * a picture of the page.
 */
export const DEV_TOOLS_ATTRIBUTE = 'data-plitzi-devtools';

/** The rule that hides the dev tools' chrome, for a capture of the page alone. */
export const HIDE_DEV_TOOLS_CSS = `[${DEV_TOOLS_ATTRIBUTE}] { display: none !important; }`;

/**
 * The mark of the page a project's server answers with while its space does not author (`spaceFailure.ts`): a page of
 * Plitzi's own, not the space's. Whatever reads the page — `plitzi page measure`, `page outline` — says it, rather than
 * "No element …" for every element asked (encore-2's dev-2 read that six times).
 */
export const SPACE_FAILURE_META = 'plitzi-space-failure';
