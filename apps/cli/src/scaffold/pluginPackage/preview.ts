import { blankSpaceSource } from '@plitzi/sdk-authoring';

import { htmlText } from './quote';

import type { PluginNames } from './names';
import type { ProjectFiles } from '../types';

/**
 * Where the plugin is looked at while it is written: inside a space, the way a page will show it.
 *
 * Not a gallery of the component on its own. What goes wrong with a plugin goes wrong in a page — the theme it did not
 * expect, the element CSS it did not apply, a flow its event never reached — so the preview is the space a new account
 * starts with, with the plugin in its hero, rendered by the SDK in the browser with no server at all.
 */

const indexHtml = ({ title }: PluginNames): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${htmlText(title)} — preview</title>
  </head>
  <body>
    <div id="plitzi-root"></div>
    <script type="module" src="/preview/main.ts"></script>
  </body>
</html>
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

const main = (): string => `import { render } from '@plitzi/plitzi-sdk';

import { authorSpace } from '@plitzi/sdk-authoring';

import { declarations } from '../src/declarations.ts';
import plugin from '../src/index.ts';
import { space } from './space.ts';

import './preflight.css';
import '@plitzi/plitzi-sdk/plitzi-sdk.css';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * The plugin, registered from its source under the type the space names it by — so a save is a hot module
 * replacement. What a published page does instead is load the built file through the manifest; \`npm run build\` is
 * what makes that file.
 */
const plugins = { [plugin.type]: { component: plugin } };

/** The types this package's elements are: named, so authoring takes them for plugins and not for typos. */
const pluginTypes = declarations.map(declaration => declaration.type);

const mount = (spec: SpaceSpec) => {
  const { schema, style, warnings } = authorSpace(spec, { pluginTypes });
  for (const warning of warnings) {
    console.warn(\`[author] \${warning.message}\`);
  }

  return render(
    'plitzi-root',
    {
      // The SDK renders the documents it is handed: no account, no key and no server in the picture.
      offlineMode: true,
      offlineData: { schema, style },
      // Straight into this page rather than into the SDK's default iframe: one document, one stylesheet.
      renderMode: 'raw',
      environment: 'main',
      // The dev tools — shift+alt+D for the panel: logs, the store, the elements, what a flow did.
      debugMode: import.meta.env.DEV
    },
    plugins
  );
};

let mounted = mount(space);

if (import.meta.hot) {
  import.meta.hot.accept('./space.ts', updated => {
    // Cast because the dev server cannot know the shape of a module it is swapping; the name is this file's own.
    const next = (updated as { space?: SpaceSpec } | undefined)?.space;
    if (!next) {
      return;
    }

    mounted?.unmount();
    mounted = mount(next);
  });
}
`;

export const previewFiles = (names: PluginNames): ProjectFiles => ({
  'index.html': indexHtml(names),
  'preview/preflight.css': preflightCss(),
  'preview/main.ts': main(),
  // The space a new account starts with, carrying the plugin in its hero as an element of its own type — how the builder
  // adds it, and how a space that loads it from its manifest hosts it. The preview's to change: put the element where
  // it will really live, give it the attributes it will really get.
  'preview/space.ts': blankSpaceSource({
    name: `${names.title} preview`,
    plugin: {
      id: names.base,
      renderType: names.type,
      as: 'element',
      attributes: { label: names.title, start: 0, step: 1 }
    }
  })
});
