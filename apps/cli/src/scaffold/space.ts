import { blankSpaceSource } from '@plitzi/sdk-authoring';

import type { CreateAnswers, ProjectFiles } from './types';
import type { PluginHostOptions } from '@plitzi/sdk-authoring';

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

import { declarations } from './plugins/declarations.ts';
import { space } from './space.ts';

const { schema, style, warnings } = authorSpace(space, { plugins: declarations });

mkdirSync('space', { recursive: true });
writeFileSync('space/offline-data.json', \`\${JSON.stringify({ schema, style }, null, 2)}\\n\`);

for (const warning of warnings) {
  console.warn(\`[author] \${warning.message}\`);
}

console.log('space/offline-data.json');
`;

/** The numbers the example shows: in a data file where one is served, on the element where none is. */
const STATS = { value: 12480, series: [8, 12, 9, 17, 14, 21, 19, 26] };

/**
 * The plugin the copy hosts, and what it is authored with.
 *
 * Asked for here rather than defaulted on in the package: the platform authors a new space from the same
 * declaration and hosts nobody's plugins, so the slot exists only where a project carries the component to fill
 * it. Its attributes are the component's props, by name. A client project serves `public/`, so there the numbers
 * come from a data file through a provider — the way a project with no backend shows data it did not invent.
 */
const pluginHost = ({ mode }: CreateAnswers): PluginHostOptions =>
  mode === 'client'
    ? {
        id: 'stat-card',
        renderType: 'statCard',
        attributes: { label: 'Requests today', unit: 'reqs' },
        data: {
          id: 'stats',
          query: '/data/stats.json',
          bind: { value: 'stats.data.value', series: 'stats.data.series' }
        }
      }
    : { id: 'stat-card', renderType: 'statCard', attributes: { label: 'Requests today', unit: 'reqs', ...STATS } };

export const spaceFiles = (answers: CreateAnswers): ProjectFiles =>
  answers.source === 'cloud'
    ? {}
    : {
        'src/space.ts': blankSpaceSource({ name: answers.name, plugin: pluginHost(answers) }),
        'src/author.ts': authorScript(),
        ...(answers.mode === 'client' ? { 'public/data/stats.json': `${JSON.stringify(STATS, null, 2)}\n` } : {})
      };
