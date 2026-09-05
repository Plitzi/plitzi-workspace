import { blankSpaceSource } from '@plitzi/sdk-authoring';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The space, copied into the project as something the developer can change.
 *
 * Not imported from `@plitzi/sdk-authoring` at run time, and that is the whole point: a project whose space came
 * from a package could only ever render Plitzi's blank space, and the first thing anybody wants is to make it
 * theirs. What lands in `src/space.ts` is the declaration itself — a tree, some CSS, a palette — so editing the
 * space is editing this project.
 *
 * It is the same source the platform authors a new space from, so what `plitzi create` starts you with and what
 * signing up gives you cannot come apart.
 */

/**
 * Writes the declaration out as documents.
 *
 * Nothing in the project reads it — the server and the browser both author at boot — so it exists for the moment
 * the space has to go somewhere else: imported into Plitzi, handed to another server, or checked into a
 * repository with no TypeScript in it.
 */
const authorScript = (): string => `import { mkdirSync, writeFileSync } from 'node:fs';

import { authorSpace } from '@plitzi/sdk-authoring';

import { space } from './space';

const { schema, style, warnings } = authorSpace(space);

mkdirSync('space', { recursive: true });
writeFileSync('space/offline-data.json', \`\${JSON.stringify({ schema, style }, null, 2)}\\n\`);

for (const warning of warnings) {
  console.warn(\`[author] \${warning.message}\`);
}

console.log('space/offline-data.json');
`;

/**
 * The plugin the copy hosts, and the numbers it is authored with.
 *
 * Asked for here rather than defaulted on in the package: the platform authors a new space from the same
 * declaration and hosts nobody's plugins, so the slot exists only where a project carries the component to fill
 * it. The settings are what the component reads as props — a plain object here, a JSON string on the element,
 * and the same names on both sides.
 */
const PLUGIN_HOST = {
  id: 'stat-card',
  renderType: 'statCard',
  settings: { label: 'Requests today', value: 12480, unit: 'reqs', series: [8, 12, 9, 17, 14, 21, 19, 26] }
};

export const spaceFiles = ({ source, name }: CreateAnswers): ProjectFiles =>
  source === 'cloud'
    ? {}
    : {
        'src/space.ts': blankSpaceSource({ name, plugin: PLUGIN_HOST }),
        'src/author.ts': authorScript()
      };
