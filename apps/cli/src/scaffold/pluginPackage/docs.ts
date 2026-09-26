import { installCommand, runCommand } from '../packageManager';
import { pluginNames } from './names';

import type { PluginNames } from './names';
import type { PluginAnswers, ProjectFiles } from '../types';

const readme = (elements: PluginNames[], { packageName, packageManager }: PluginAnswers): string => {
  const run = (script: string): string => runCommand(packageManager, script);
  const { base } = pluginNames(packageName);
  const [{ type, component }] = elements;
  const held = elements.map(element => `\`${element.type}\``).join(', ');

  return `# ${packageName}

A Plitzi plugin: ${elements.length === 1 ? 'an element' : 'elements'} of your own that any space can render — ${held}.
An element of that type renders the component in its folder under \`src/\`, and its attributes arrive as the
component's props.

\`\`\`bash
${installCommand(packageManager)}
${run('start')}    # the plugin inside a space, with hot module replacement
${run('visual')}   # a browser opens the preview and checks the plugin works
npx @plitzi/cli pack plugin   # the plugin, built — and zipped the way the builder takes it
\`\`\`

## What is where

Each element is written the way Plitzi's own elements are (\`@plitzi/sdk-elements\`): one folder, four files.

- \`src/${component}/${component}.tsx\` — the component: what a page renders.
- \`src/${component}/declaration.ts\` — the element as the platform knows it: its \`type\`, the events it fires and the
  actions it answers to, its starting attributes, how the catalogue shows it and its default style. Data only; the build
  writes it into the manifest.
- \`src/${component}/Settings.tsx\` — its panel in the builder.
- \`src/${component}/index.ts\` — the three put together: what a space loads.
- \`src/elements.ts\` and \`src/declarations.ts\` — every element the package holds, the one it is named after first:
  \`src/index.ts\` publishes the first as the plugin and the rest as its \`plugins\`, and the build writes each
  declaration into the manifest.
- \`preview/\` — a space to look at the plugin in, rendered in the browser with no server.

## Publishing

\`npx @plitzi/cli pack plugin\` builds the plugin — the CLI is the one place a plugin is packed, so this package carries
no build of its own. It writes \`dist/\`: \`${base}.mjs\`, \`plugin-manifest.json\` — which the builder, the page server and
the MCP server read to know the plugin before they load it — and \`types/\`, the declarations a project installing the
package reads. Beside it, \`${base}-<version>.zip\`.

- **Through the builder.** Upload the zip under **Resources**, as a plugin: the platform unpacks it at an address of its
  own and the space can use it.
- **From your own host.** Serve \`dist/\` at an address that never changes for a given version
  (\`https://cdn.example.com/${base}/0.1.0\`), with CORS open to plain reads, and list it in the space's plugins:
  \`{ type: '${type}', resource: '<that address>' }\`.
- **On npm.** Pack first, then publish: \`exports\` points at \`dist/\`.

## In a project of your own

- **In the browser** — \`render()\`, or \`<PlitziSdk>\` in a React application — install the package and register every
  element it holds:

  \`\`\`ts
  import { elements } from '${packageName}';

  render('root', options, Object.fromEntries(elements.map(element => [element.type, { component: element }])));
  \`\`\`

- **On a page server of your own**, compile each element from its source, which is what renders it on the server:
  \`plugins: { ${type}: { js: path.resolve('node_modules/${packageName}/src/${component}/index.ts'), action: 'compile' } }\`,
  one entry per element, each named in the deployment's \`pluginNames\`.

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

## Another element

\`\`\`bash
npx @plitzi/cli add plugin legend
\`\`\`

Run in this package, it writes \`src/Legend/\` and lists it in \`src/elements.ts\` and \`src/declarations.ts\` — the
package publishes it from then on, beside \`${type}\`. Put an \`element('legend', { id: 'legend' })\` in
\`preview/space.ts\` to look at it.
`;
};

const agents = (elements: PluginNames[], { packageName, packageManager }: PluginAnswers): string => {
  const run = (script: string): string => `\`${runCommand(packageManager, script)}\``;

  return `# ${packageName} — notes for agents

A Plitzi plugin holding ${elements.map(element => `\`${element.type}\` (\`src/${element.component}\`)`).join(', ')}, each written
the way \`@plitzi/sdk-elements\` writes its own. An element's \`declaration.ts\` says how the platform knows it.

- ${run('start')} — the preview: the plugin inside a space.
- ${run('visual')} — a browser checks the preview.
- ${run('typecheck')} and ${run('lint')} — before calling a change done.
- \`npx @plitzi/cli pack plugin\` — \`dist/\` (the module, \`plugin-manifest.json\`, the types) and the zip for the builder.
- \`npx @plitzi/cli add plugin <name>\` — another element, in the same shape; \`upload plugin\` puts the zip on a space.
  Everything the CLI does, and how it behaves with nobody at the terminal: \`.claude/skills/plitzi-cli/SKILL.md\`.

- The component's props are the element's attributes. A new one goes in three places: the props, the declaration
  (\`content.attributes\`, and \`bindingsAllowed\` if data may drive it), and \`Settings.tsx\`.
- A new event or action is declared in \`declaration.ts\` (\`triggers\`, \`callbacks\`) and registered by the component
  from there — never only in the component.
- Render through \`RootElement\`; never render anything on the first pass that differs between a server and a browser.
- Never bundle a second React or SDK: the page provides both — see the README's contract.
- \`type\` in the declaration is what every space using the plugin names; renaming it orphans those elements.
`;
};

export const docsFiles = (elements: PluginNames[], answers: PluginAnswers): ProjectFiles => ({
  'README.md': readme(elements, answers),
  'AGENTS.md': agents(elements, answers),
  // Claude Code reads CLAUDE.md, other agents AGENTS.md: one imports the other, so there is one text to keep true.
  'CLAUDE.md': '@AGENTS.md\n'
});
