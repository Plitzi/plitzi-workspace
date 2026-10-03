import { blankSpaceSource, catalogTemplateFiles, emptySpaceSource } from '@plitzi/sdk-authoring';

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
const authorScript = (): string => `import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { authorSpace, refusalOf, SpaceRefusedError } from '@plitzi/sdk-authoring';

import { declarations } from './plugins/declarations.ts';
import { space } from './space.ts';

// \`--json\` answers in one object, for a tool or an agent; otherwise one line on success, the problems on failure.
const json = process.argv.includes('--json');

/**
 * The skill an agent reads was copied from the SDK at one version: a newer SDK has what the older skill never taught.
 * Both versions, when they differ — \`npx @plitzi/cli skills update\` brings the skill up to the SDK.
 */
const outdatedSkill = (): { skill: string; sdk: string } | undefined => {
  let skill: string | undefined;
  try {
    skill = /^version: (.+)$/m.exec(readFileSync('.claude/skills/plitzi-authoring/SKILL.md', 'utf-8'))?.[1]?.trim();
  } catch {
    return undefined;
  }

  const manifest: unknown = JSON.parse(
    readFileSync(createRequire(import.meta.url).resolve('@plitzi/sdk-authoring/package.json'), 'utf-8')
  );
  const sdk =
    typeof manifest === 'object' && manifest !== null && 'version' in manifest && typeof manifest.version === 'string'
      ? manifest.version
      : undefined;

  return skill && sdk && skill !== sdk ? { skill, sdk } : undefined;
};

try {
  const { schema, style, warnings } = authorSpace(space, { plugins: declarations });
  mkdirSync('space', { recursive: true });
  writeFileSync('space/offline-data.json', \`\${JSON.stringify({ schema, style }, null, 2)}\\n\`);

  const outdated = outdatedSkill();
  if (json) {
    console.log(JSON.stringify({ ok: true, pages: schema.pages.length, warnings, ...(outdated ? { outdated } : {}) }));
  } else {
    for (const warning of warnings) {
      console.warn(\`[author] \${warning.code} · \${warning.message}\`);
    }

    if (outdated) {
      console.warn(
        \`[skills] the authoring skill is \${outdated.skill} and @plitzi/sdk-authoring is \${outdated.sdk}: npx @plitzi/cli skills update\`
      );
    }

    console.log(\`ok · \${schema.pages.length} pages · \${warnings.length} warnings · space/offline-data.json\`);
  }
} catch (error) {
  // The message is the whole report — every problem, where it was written and what to change. The stack would only
  // point inside @plitzi/sdk-authoring.
  const refusals = error instanceof SpaceRefusedError ? error.refusals : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    console.log(JSON.stringify({ ok: false, refusals: refusals ?? [{ place: '', ...refusalOf(error) }] }));
  } else {
    console.error(message);
  }

  process.exitCode = 1;
}
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

export const spaceFiles = (answers: CreateAnswers): ProjectFiles => {
  if (answers.source === 'cloud') {
    return {};
  }

  if (answers.template === 'catalog') {
    return { ...catalogTemplateFiles({ name: answers.name }), 'src/author.ts': authorScript() };
  }

  if (answers.template === 'blank') {
    return {
      'src/space.ts': emptySpaceSource({ name: answers.name }),
      'src/author.ts': authorScript(),
      'public/data/.gitkeep': ''
    };
  }

  return {
    'src/space.ts': blankSpaceSource({ name: answers.name, plugin: pluginHost(answers) }),
    'src/author.ts': authorScript(),
    ...(answers.mode === 'client' ? { 'public/data/stats.json': `${JSON.stringify(STATS, null, 2)}\n` } : {})
  };
};
