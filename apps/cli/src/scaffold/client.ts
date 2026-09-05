import type { CreateAnswers, ProjectFiles } from './types';

/**
 * Client mode: the SDK renders in the browser and there is no server at all.
 *
 * Vite is what makes this the live loop — a save is a hot module replacement, so editing the space updates the
 * page without reloading it. Nothing here is a build artefact of Plitzi's: the page is this project's, and the
 * SDK is a dependency it imports.
 */

const indexHtml = ({ name }: CreateAnswers): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="plitzi-root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

const viteConfig = (): string => `import { defineConfig } from 'vite';

/**
 * Nothing Plitzi-specific: the SDK is an ordinary dependency, so this is a plain Vite app.
 *
 * The host is pinned because Vite binds \`localhost\` — which on this machine is IPv6 — while everything that
 * waits for a dev server to come up asks for 127.0.0.1. The two resolve differently, so the visual suite sat
 * there watching an address nothing was listening on until it gave up.
 */
export default defineConfig({
  server: { host: '127.0.0.1', port: 5173 }
});
`;

const preflightCss = (): string => `/*
 * The SDK ships no global CSS on purpose: dropping a space into an existing site must not restyle that site.
 * The browser's own margins therefore survive unless the host page clears them, which is what this does.
 */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
`;

/** The two ways the space reaches the entry point, written once because both modes phrase them identically. */
const localMain = (): string => `import { render } from '@plitzi/plitzi-sdk';

import { authorSpace } from '@plitzi/sdk-authoring';

import { blankSpaceSpec } from './space';

import './preflight.css';
import '@plitzi/plitzi-sdk/plitzi-sdk.css';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * The space, held in this project.
 *
 * \`src/space.ts\` is a declaration — a tree, some CSS, a palette — and \`authorSpace\` turns it into the two
 * documents the SDK renders. Editing it is editing the site.
 */
const mount = (spec: SpaceSpec) =>
  render('plitzi-root', {
    /**
     * What makes this run with no backend: the SDK renders the documents it is handed instead of fetching a
     * space, so there is no account, no key and no server in the picture.
     */
    offlineMode: true,
    offlineData: authorSpace(spec),
    /**
     * Without this the SDK renders inside an IFRAME — its default, because a space dropped into an unknown page
     * is safest isolated from it. This page is yours, so render straight into the DOM: one document, one
     * stylesheet, no frame and no scroll trap.
     */
    renderMode: 'raw',
    environment: 'main',
    /** The page AUTHORISING the dev tools: the badge, and shift+alt+D for the panel. A published site omits it. */
    debugMode: true
  });

let mounted = mount(blankSpaceSpec);

/**
 * Hot module replacement, for real rather than as a page reload.
 *
 * Without this Vite would still update the page when the space is saved — by reloading it, because nothing
 * accepted the change. Unmounting and remounting keeps the reload out of it, which matters as soon as the page
 * has state worth not losing: a form half filled in, a menu open, a scroll position.
 */
if (import.meta.hot) {
  import.meta.hot.accept('./space', (updated?: { blankSpaceSpec: SpaceSpec }) => {
    if (!updated) {
      return;
    }

    mounted?.unmount();
    mounted = mount(updated.blankSpaceSpec);
  });
}
`;

const cloudMain = (): string => `import { render } from '@plitzi/plitzi-sdk';

import './preflight.css';
import '@plitzi/plitzi-sdk/plitzi-sdk.css';

/**
 * The space's public RENDER key.
 *
 * It ships in the page by design — anyone who views source can read it — and what keeps a copied one from working
 * is that the browser states the origin it is presenting from, which the key is bound to. Add this project's
 * domain to the space's allowed domains, or the space refuses to load.
 */
const WEB_KEY = import.meta.env.VITE_PLITZI_WEB_KEY ?? '';

if (!WEB_KEY) {
  throw new Error('Set VITE_PLITZI_WEB_KEY in .env — Credentials, in the builder.');
}

render('plitzi-root', {
  webKey: WEB_KEY,
  environment: import.meta.env.VITE_PLITZI_ENVIRONMENT ?? 'main',
  // The page is ours, so render into the document rather than into the SDK's default iframe.
  renderMode: 'raw',
  debugMode: true
});
`;

export const clientFiles = (answers: CreateAnswers): ProjectFiles => ({
  'index.html': indexHtml(answers),
  'vite.config.ts': viteConfig(),
  'src/preflight.css': preflightCss(),
  'src/main.ts': answers.source === 'cloud' ? cloudMain() : localMain()
});
