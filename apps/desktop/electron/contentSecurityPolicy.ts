/* eslint-disable quotes */

/**
 * The Content Security Policy this window renders under.
 *
 * Electron warns about the absence of one, and the warning is worth acting on rather than silencing: this window
 * renders a document authored somewhere else — a space, with its own markup, its own pictures and whatever a
 * plugin decided to fetch — so what that document may reach is exactly the thing to write down.
 *
 * Each directive is what the app actually does, and nothing more:
 * - `script-src 'self' blob: https:` — three things, each one something the SDK actually does. `'self'` is this
 *   bundle. `blob:` is how a remote plugin runs: it is fetched over HTTP and then `import()`ed as a blob, and
 *   without it every plugin in a space draws as "not found" — silently, because `loadComponent` catches the
 *   failure. `https:` is for the script an AUTHOR puts in a `BlockHtml` element, which is a feature of the
 *   product rather than an accident. Inline script is NOT allowed, so an author's inline `<script>` and the
 *   importmap `generateFacade` writes do not run here; and never `unsafe-eval`.
 * - `style-src` needs `'unsafe-inline'`: a space's stylesheet is compiled at run time and injected as a `<style>`,
 *   which a nonce cannot cover without the SDK knowing there is one.
 * - `img-src` / `font-src` are open over https because a space's pictures and faces are the author's, hosted
 *   wherever they host them, and `data:` / `blob:` because the SDK builds some of them itself.
 * - `connect-src` is the API, the GraphQL server and its sockets.
 * - `frame-src` for the SDK's iframe render mode, and for a space that embeds something.
 * - `object-src 'none'` and `base-uri 'self'` — nothing here needs either, and both are worth refusing.
 *
 * The `dev` relaxations exist for the Vite dev server alone: its HMR socket, and the inline bootstrap it writes
 * into the page. A packaged window gets neither.
 */
export const contentSecurityPolicy = (dev: boolean): string =>
  [
    "default-src 'self'",
    `script-src 'self' blob: https:${dev ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src 'self' https: wss:${dev ? ' ws://localhost:* http://localhost:*' : ''}`,
    "frame-src 'self' https:",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

export default contentSecurityPolicy;
