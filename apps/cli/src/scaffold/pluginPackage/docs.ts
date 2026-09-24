import { installCommand, runCommand } from '../packageManager';

import type { PluginNames } from './names';
import type { PluginAnswers, ProjectFiles } from '../types';

const readme = (names: PluginNames, { packageManager }: PluginAnswers): string => {
  const run = (script: string): string => runCommand(packageManager, script);
  const { packageName, type, component, base } = names;

  return `# ${packageName}

A Plitzi plugin: an element of your own that any space can render. A \`custom\` element naming
\`renderType: '${type}'\` renders the component in \`src/${component}\`, and the element's attributes arrive as its props.

\`\`\`bash
${installCommand(packageManager)}
${run('start')}    # the plugin inside a space, with hot module replacement
${run('visual')}   # a browser opens the preview and checks the plugin works
${run('zip')}      # build, then pack the build the way the builder takes it
\`\`\`

## What is where

The element is written the way Plitzi's own elements are (\`@plitzi/sdk-elements\`): one folder, four files.

- \`src/${component}/${component}.tsx\` — the component: what a page renders.
- \`src/${component}/declaration.ts\` — the element as the platform knows it: its \`type\`, the events it fires and the
  actions it answers to, its starting attributes, how the catalogue shows it and its default style. Data only; the build
  writes it into the manifest.
- \`src/${component}/Settings.tsx\` — its panel in the builder.
- \`src/${component}/index.ts\` — the three put together: what a space loads.
- \`src/declarations.ts\` — every element the package holds, for the manifest.
- \`preview/\` — a space to look at the plugin in, rendered in the browser with no server.

## Publishing

\`${run('build')}\` writes \`dist/\`: \`${base}.mjs\` and \`plugin-manifest.json\`, which the builder, the page server and the
MCP server read to know the plugin before they load it.

- **Through the builder.** \`${run('zip')}\` writes \`${base}-<version>.zip\`. Upload it under **Resources**, as a plugin: the
  platform unpacks it at an address of its own and the space can use it.
- **From your own host.** Serve \`dist/\` at an address that never changes for a given version
  (\`https://cdn.example.com/${base}/0.1.0\`), with CORS open to the sites that use it, and list it in the space's
  plugins: \`{ type: '${type}', resource: '<that address>' }\`.

## The contract

- **React and the SDK are the page's.** The build keeps \`react\`, \`react-dom\` and \`@plitzi/plitzi-sdk\` out of the
  bundle and imports the page's copies — a second React is "Invalid hook call" and a blank element. Anything else you
  import is bundled.
- **One file.** A page imports the plugin from a blob URL, where a second chunk has nowhere to be found, so the build
  never splits it. Import freely; it all ends up in \`${base}.mjs\`.
- **Render \`RootElement\`, not a \`div\`.** It is what makes the plugin an _element_: the id and classes the space gave
  it land on what you render, so the CSS authored on it applies, the builder can select it, a test can find it, and
  its events and actions are its own.
- **Nothing that differs between a server and the first render in the browser** — a clock, a random number, anything
  read out of \`window\`. React answers a hydration mismatch by discarding the whole tree: it does not break the plugin,
  it blanks the page. Put live values in an effect.
- **Do not name colours.** The page has a palette and a light/dark theme; use \`currentColor\` and the space's own
  \`var(--…)\` variables.

## More than one element

A package can hold several: export the others as \`plugins\` from \`src/index.ts\`
(\`export const plugins = { legend: Legend }\`) and give each an entry in \`pluginSchema\` beside \`${type}\`'s.
`;
};

const agents = (names: PluginNames, { packageManager }: PluginAnswers): string => {
  const run = (script: string): string => `\`${runCommand(packageManager, script)}\``;

  return `# ${names.packageName} — notes for agents

A Plitzi plugin: the \`${names.type}\` element, in \`src/${names.component}\`, written the way \`@plitzi/sdk-elements\` writes its
own. \`declaration.ts\` there says how the platform knows it.

- ${run('start')} — the preview: the plugin inside a space.
- ${run('visual')} — a browser checks the preview.
- ${run('typecheck')} and ${run('lint')} — before calling a change done.
- ${run('build')} — \`dist/\`: the module and \`plugin-manifest.json\`.

- The component's props are the element's attributes. A new one goes in three places: the props, the declaration
  (\`content.attributes\`, and \`bindingsAllowed\` if data may drive it), and \`Settings.tsx\`.
- A new event or action is declared in \`declaration.ts\` (\`triggers\`, \`callbacks\`) and registered by the component
  from there — never only in the component.
- Render through \`RootElement\`; never render anything on the first pass that differs between a server and a browser.
- Never import a second React or SDK, and never make the build split into chunks — see the README's contract.
- \`type\` in the declaration is what every space using the plugin names; renaming it orphans those elements.
`;
};

export const docsFiles = (names: PluginNames, answers: PluginAnswers): ProjectFiles => ({
  'README.md': readme(names, answers),
  'AGENTS.md': agents(names, answers),
  // Claude Code reads CLAUDE.md, other agents AGENTS.md: one imports the other, so there is one text to keep true.
  'CLAUDE.md': '@AGENTS.md\n'
});
