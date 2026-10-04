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

import { authorSpace, planFixes, refusalOf, SpaceRefusedError } from '@plitzi/sdk-authoring';

import { declarations } from './plugins/declarations.ts';
import { space } from './space.ts';

// \`--json\` answers in one object, for a tool or an agent; otherwise one line on success, the problems on failure.
const json = process.argv.includes('--json');

/** How many of the warnings and suggestions said have one fix \`plitzi fix\` can write in this source — and the line that says so. */
const fixableHint = (): string | undefined => {
  let count: number;
  try {
    count = planFixes(space, { plugins: declarations }).fixes.length;
  } catch {
    return undefined;
  }

  return count === 0 ? undefined : \`[fix] \${count} of these have one fix: npx plitzi fix shows it in your source, --write writes it\`;
};

/** A file's text, or undefined when there is none to read. */
const readOptional = (file: string): string | undefined => {
  try {
    return readFileSync(file, 'utf-8');
  } catch {
    return undefined;
  }
};

/**
 * What of the project is older than the SDK installed: the skill an agent reads, copied from the SDK at one version,
 * and the files the CLI wrote (\`.plitzi/scaffold.json\`) — a newer SDK has what neither taught nor wired. Each version
 * that differs — \`npx plitzi upgrade\` brings both up.
 */
const outdated = (): { skill?: string; files?: string; sdk: string } | undefined => {
  const manifest: unknown = JSON.parse(
    readFileSync(createRequire(import.meta.url).resolve('@plitzi/sdk-authoring/package.json'), 'utf-8')
  );
  const sdk =
    typeof manifest === 'object' && manifest !== null && 'version' in manifest && typeof manifest.version === 'string'
      ? manifest.version
      : undefined;
  const skill = /^version: (.+)$/m.exec(readOptional('.claude/skills/plitzi-authoring/SKILL.md') ?? '')?.[1]?.trim();
  const record: unknown = JSON.parse(readOptional('.plitzi/scaffold.json') ?? 'null');
  const files =
    typeof record === 'object' && record !== null && 'cli' in record && typeof record.cli === 'string'
      ? record.cli
      : undefined;
  if (!sdk || ((!skill || skill === sdk) && (!files || files === sdk))) {
    return undefined;
  }

  return { ...(skill && skill !== sdk ? { skill } : {}), ...(files && files !== sdk ? { files } : {}), sdk };
};

try {
  const { schema, style, warnings, suggestions } = authorSpace(space, { plugins: declarations });
  mkdirSync('space', { recursive: true });
  writeFileSync('space/offline-data.json', \`\${JSON.stringify({ schema, style }, null, 2)}\\n\`);

  const behind = outdated();
  if (json) {
    console.log(
      JSON.stringify({ ok: true, pages: schema.pages.length, warnings, suggestions, ...(behind ? { outdated: behind } : {}) })
    );
  } else {
    for (const warning of warnings) {
      console.warn(\`[author] \${warning.code} · \${warning.message}\`);
    }

    // Not problems: a shorter way to the same page, the one that saves the most elements first.
    for (const suggestion of suggestions) {
      const at = suggestion.at ? \` · \${suggestion.at}\` : '';
      console.warn(\`[suggest] \${suggestion.code} · \${suggestion.message} (saves \${suggestion.saves})\${at}\`);
    }

    // After both: \`plitzi fix\` writes a warning's fix and a suggestion's alike, where it has one reading.
    const hint = warnings.length + suggestions.length > 0 ? fixableHint() : undefined;
    if (hint) {
      console.warn(hint);
    }

    if (behind) {
      const older = [
        behind.skill ? \`the authoring skill is \${behind.skill}\` : '',
        behind.files ? \`its files are from \${behind.files}\` : ''
      ].filter(Boolean);
      console.warn(
        \`[upgrade] \${older.join(' and ')}, and @plitzi/sdk-authoring is \${behind.sdk}: npx plitzi upgrade shows what changes, --write makes it\`
      );
    }

    console.log(
      \`ok · \${schema.pages.length} pages · \${warnings.length} warnings · \${suggestions.length} suggestions · space/offline-data.json\`
    );
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
    const hint = fixableHint();
    if (hint) {
      console.error(hint);
    }
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
