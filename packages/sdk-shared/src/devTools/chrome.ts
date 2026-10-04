/**
 * The attribute every piece of the dev tools' own chrome carries — the badge, the panel — so whatever looks at the
 * page rather than at the tools can leave it out: `plitzi shot` and `plitzi check` hide it, and a picture of a page is
 * a picture of the page.
 */
export const DEV_TOOLS_ATTRIBUTE = 'data-plitzi-devtools';

/** The rule that hides the dev tools' chrome, for a capture of the page alone. */
export const HIDE_DEV_TOOLS_CSS = `[${DEV_TOOLS_ATTRIBUTE}] { display: none !important; }`;
