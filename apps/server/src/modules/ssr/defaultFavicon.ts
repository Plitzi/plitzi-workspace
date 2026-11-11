import { PLITZI_MARK_SVG } from '@plitzi/sdk-shared/schema';

/**
 * Plitzi's icon: the tab of a space that names none (`DEFAULT_FAVICON`, `@plitzi/sdk-shared/schema`), served by the
 * page server itself at that address. It was Plitzi's CDN, another site: in local, on `*.plitzi.app` or on a server of
 * one's own, every page that named no icon asked another site for one, and the browser sent that site's cookies with
 * it — Lighthouse's "Uses third-party cookies".
 *
 * Kept as text rather than a file beside the module: the server's build moves its modules into chunks, and a deployment
 * bundles them again (a project's server, `bundleProject`) — a string goes wherever its module goes.
 */
export const DEFAULT_FAVICON_SVG = PLITZI_MARK_SVG;
