import { blankTemplateFiles, catalogTemplateFiles, emptySpaceSource } from '@plitzi/sdk-authoring';

import { AUTHOR_FILE, SPACE_DIR, SPACE_ENTRY } from './paths';

import type { CreateAnswers, ProjectFiles } from './types';
import type { PluginHostOptions } from '@plitzi/sdk-authoring';

/**
 * The space, copied into the project as something the developer can change.
 *
 * Not imported from `@plitzi/sdk-authoring` at run time, and that is the whole point: a project whose space came
 * from a package could only ever render Plitzi's blank space, and the first thing anybody wants is to make it
 * theirs. What lands in `src/space/` is the declaration itself — a tree, some CSS, a palette, a file each — so
 * editing the space is editing this project.
 *
 * It is the same source the platform authors a new space from, so what `plitzi create` starts you with and what
 * signing up gives you cannot come apart.
 */

/**
 * Authors the declaration and says what it found: the check an agent and a person run after every change.
 *
 * It writes nothing — the space is \`src/space/\`, and the server and the browser both author it at boot. Only the
 * server asks for the documents, while developing: it runs this on a save with \`--ipc\`, and is handed them back.
 */
const authorScript = (): string => `import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { authorSpace, planFixes, refusalOf, SpaceRefusedError } from '@plitzi/sdk-authoring';
import { projectSpace } from '@plitzi/sdk-authoring/node';

import type { ProjectSpaceSource } from '@plitzi/sdk-authoring/node';

// \`--json\` answers in one object, for a tool or an agent; otherwise one line on success, the problems on failure.
const json = process.argv.includes('--json');
// \`--ipc\`: the project's server ran this on a save, while developing, and is handed the documents it serves next.
const ipc = process.argv.includes('--ipc');

/** How many of the warnings and suggestions said have one fix \`plitzi space fix\` can write in this source — and the line that says so. */
const fixableHint = ({ space, authoring }: ProjectSpaceSource): string | undefined => {
  let count: number;
  try {
    count = planFixes(space, authoring).fixes.length;
  } catch {
    return undefined;
  }

  return count === 0 ? undefined : \`[fix] \${count} of these have one fix: npx plitzi space fix shows it in your source, --write writes it\`;
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

// Read before the space is authored, so the catch below can say what of a refusal \`plitzi space fix\` writes.
let project: ProjectSpaceSource | undefined;
try {
  // The space and what it is checked against — what the server reads too: its plugins' declarations, the built ones'
  // types, the files a provider reads — from the project's root, where its scripts run this. A project laid out where
  // its server would not read it, or a space module that exports none, is refused here, every error said.
  project = await projectSpace();
  const { schema, style, warnings, suggestions } = authorSpace(project.space, project.authoring);
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

    // After both: \`plitzi space fix\` writes a warning's fix and a suggestion's alike, where it has one reading.
    const hint = warnings.length + suggestions.length > 0 ? fixableHint(project) : undefined;
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
      \`ok · \${schema.pages.length} pages · \${warnings.length} warnings · \${suggestions.length} suggestions\`
    );
  }

  // Last: an open channel keeps this process alive, so it is let go once the documents are on their way.
  if (ipc) {
    process.send?.({ schema, style }, () => process.disconnect?.());
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
    const hint = project && fixableHint(project);
    if (hint) {
      console.error(hint);
    }
  }

  process.exitCode = 1;
  // Nothing to hand over: the server keeps serving the last space that authored.
  if (ipc) {
    process.disconnect?.();
  }
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
    return {
      ...catalogTemplateFiles({ name: answers.name, mode: answers.mode }),
      [AUTHOR_FILE]: authorScript()
    };
  }

  if (answers.template === 'blank') {
    return {
      [SPACE_ENTRY]: emptySpaceSource({ name: answers.name }),
      [AUTHOR_FILE]: authorScript(),
      // A project with no server keeps its data where the browser fetches it; a server's is `src/data/` (`serverFiles`).
      ...(answers.mode === 'client' ? { 'public/data/.gitkeep': '' } : {})
    };
  }

  return {
    ...blankTemplateFiles({ name: answers.name, dir: SPACE_DIR, plugin: pluginHost(answers) }),
    [AUTHOR_FILE]: authorScript(),
    // As the project's own formatter writes it — a short list on one line — so its first `format` changes nothing.
    ...(answers.mode === 'client'
      ? {
          'public/data/stats.json': `{\n  "value": ${String(STATS.value)},\n  "series": ${JSON.stringify(STATS.series).replaceAll(',', ', ')}\n}\n`
        }
      : {})
  };
};
