import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { finding } from './catalog';
import { withoutDisabled } from './directives';
import { RULES } from './rules';
import { readSpaceSources } from './sources';
import { authoringFindings } from './suggestions';
import { projectHere, readPackageJson } from '../commands/existingProject';
import { blockingLegacy } from '../commands/legacyLayout';
import { fail } from '../commands/terminal';
import { loadTypeScript } from '../projectTypeScript';
import { DATA_DIR, SPACE_DIR, SPACE_ENTRY } from '../scaffold/paths';
import { CLI_VERSION } from '../scaffold/project';

import type { LintContext, LintFinding, Severity } from './types';
import type TypeScript from 'typescript';

export type { LintFinding, Severity } from './types';

/**
 * `plitzi lint`: the space's SOURCE read for good practices, eslint's way — each finding at its file and line, with
 * what to write instead. What it reads is how the space is written: a file too long to read whole, every page in one
 * file, rows of data inline, a colour where a token belongs, the same CSS copied, a row singled out inside a `map`, a
 * name the builder minted, a file nothing imports. Beside them, what authoring suggests about the space it authors to
 * (`suggestions`), whatever their codes, at the line that wrote each element.
 *
 * Not whether the space is valid — `npm run author` — nor a page as it renders — `plitzi check` — nor the project
 * around it — `plitzi doctor`: every report says so (`notChecked`).
 *
 * Exit code 1 when anything is an error; with `--strict` a warning too, with `--max-warnings <n>` more than n of them —
 * so a CI step or a pre-commit hook can hold a space to it.
 *
 *   plitzi lint
 *   plitzi lint --json
 *   plitzi lint --max-warnings 0
 */

export interface LintOptions {
  json?: boolean;
  /** Warnings fail too. */
  strict?: boolean;
  /** More warnings than this fail. */
  maxWarnings?: number;
}

/**
 * What `plitzi lint` does not check, and what does — said in every report, so nobody takes a clean lint for a space
 * that authors, a page that renders or a project that installs.
 */
export const NOT_CHECKED = [
  { what: 'whether the space authors — what it refuses and warns of', by: 'npm run author' },
  { what: 'a page as it renders', by: 'plitzi check' },
  { what: 'the project around the space — packages, configs, imports, plugins, data files', by: 'plitzi doctor' }
] as const;

export interface LintReport {
  cli: string;
  /** Always the space's source, as written — never the project around it nor the page it renders (`notChecked`). */
  scope: 'space-source';
  notChecked: typeof NOT_CHECKED;
  project: { root: string; name: string; entry: string; files: number };
  ok: boolean;
  strict: boolean;
  maxWarnings?: number;
  counts: Record<Severity, number>;
  findings: LintFinding[];
}

/** Where a space is, and what is not part of it, for the rules. */
export interface SpaceSourceOptions {
  root: string;
  entry: string;
  spaceDir: string;
  dataDir: string;
  /** Folders of the project the space may import from that are not the space: its plugins. */
  excluded: readonly string[];
}

/** A rule that could not finish says so, as what it is — never a lint that crashes on the space it reads. */
const guarded = (rule: (context: LintContext) => LintFinding[], context: LintContext): LintFinding[] => {
  try {
    return rule(context);
  } catch (error) {
    return [
      finding(
        'source-unreadable',
        `A rule could not finish reading the source: ${error instanceof Error ? error.message : String(error)}`
      )
    ];
  }
};

/** The source rules' findings, without what the source says to leave out: what a space is written as. */
export const lintSpaceSource = async (
  ts: typeof TypeScript,
  options: SpaceSourceOptions
): Promise<{ findings: LintFinding[]; files: number }> => {
  const { files, unreached } = await readSpaceSources(ts, options);
  const context: LintContext = {
    ts,
    root: options.root,
    entry: options.entry,
    dataDir: options.dataDir,
    files,
    unreached
  };

  return {
    findings: withoutDisabled(
      RULES.flatMap(rule => guarded(rule, context)),
      files
    ),
    files: files.length
  };
};

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** By file — what is about no file last — then by where in it, then the worse first. */
const byPlace = (a: LintFinding, b: LintFinding): number =>
  (a.file === undefined ? 1 : 0) - (b.file === undefined ? 1 : 0) ||
  (a.file ?? '').localeCompare(b.file ?? '') ||
  (a.line ?? 0) - (b.line ?? 0) ||
  (a.column ?? 0) - (b.column ?? 0) ||
  SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

export const reportOf = (
  project: LintReport['project'],
  findings: readonly LintFinding[],
  { strict, maxWarnings }: { strict: boolean; maxWarnings?: number }
): LintReport => {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  findings.forEach(each => {
    counts[each.severity]++;
  });

  return {
    cli: CLI_VERSION,
    scope: 'space-source',
    notChecked: NOT_CHECKED,
    project,
    ok:
      counts.error === 0 &&
      (!strict || counts.warning === 0) &&
      (maxWarnings === undefined || counts.warning <= maxWarnings),
    strict,
    ...(maxWarnings === undefined ? {} : { maxWarnings }),
    counts,
    findings: [...findings].sort(byPlace)
  };
};

/** In a file, a rule's findings past this many are counted rather than listed: `--json` lists every one. */
const LISTED_PER_RULE = 5;

const SEVERITY_TEXT: Record<Severity, string> = {
  error: chalk.red('error'),
  warning: chalk.yellow('warning'),
  info: chalk.dim('info')
};

const plural = (count: number, word: string): string => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

const fileText = (title: string, findings: readonly LintFinding[]): string[] => {
  const listed = new Map<string, number>();
  const lines = [chalk.underline(title)];
  for (const each of findings) {
    const shown = listed.get(each.code) ?? 0;
    listed.set(each.code, shown + 1);
    if (shown < LISTED_PER_RULE) {
      const where = each.line === undefined ? '-' : `${String(each.line)}:${String(each.column ?? 1)}`;
      lines.push(
        `  ${chalk.dim(where.padEnd(8))} ${SEVERITY_TEXT[each.severity]}  ${each.message}  ${chalk.dim(each.code)}`
      );
    }
  }

  for (const [code, total] of listed) {
    if (total > LISTED_PER_RULE) {
      lines.push(
        chalk.dim(`  … and ${String(total - LISTED_PER_RULE)} more ${code} in this file (--json lists every one)`)
      );
    }
  }

  return [...lines, ''];
};

/** Where the codes found are explained, each place once: a skill's reference, or `plitzi explain <code>`. */
const docsOf = (report: LintReport): string => {
  const docs = new Map<string, string[]>();
  for (const each of report.findings) {
    const key = each.origin === 'authoring' ? 'npx plitzi explain <code>' : each.docs;
    const codes = docs.get(key) ?? [];
    if (!codes.includes(each.code)) {
      docs.set(key, [...codes, each.code]);
    }
  }

  return [...docs].map(([where, codes]) => `${codes.join(', ')}: ${where}`).join('; ');
};

/** What made warnings fail, when no error did. */
const failedBy = ({ counts, strict, maxWarnings }: LintReport): string => {
  if (counts.error > 0) {
    return '';
  }

  if (strict) {
    return ' (--strict: warnings fail too)';
  }

  return maxWarnings === undefined ? '' : ` (--max-warnings ${String(maxWarnings)})`;
};

export const reportText = (report: LintReport): string => {
  const { project, counts } = report;
  const lines = [
    chalk.bold(
      `plitzi lint — ${project.name} (the space's source: ${plural(project.files, 'file')} from ${project.entry})`
    ),
    ''
  ];
  const groups = new Map<string, LintFinding[]>();
  for (const each of report.findings) {
    const title = each.file ?? 'the space (no one line wrote it)';
    groups.set(title, [...(groups.get(title) ?? []), each]);
  }

  for (const [title, findings] of groups) {
    lines.push(...fileText(title, findings));
  }

  if (report.findings.length > 0) {
    lines.push(chalk.dim(`What each means and what to write instead: the docs of each code — ${docsOf(report)}.`));
  }

  const summary = [
    plural(counts.error, 'error'),
    plural(counts.warning, 'warning'),
    ...(counts.info > 0 ? [`${String(counts.info)} noted`] : [])
  ].join(', ');
  lines.push(
    chalk.dim(`Not checked here: ${report.notChecked.map(({ what, by }) => `${what} (\`${by}\`)`).join('; ')}.`),
    report.ok
      ? chalk.green(`${counts.warning + counts.info === 0 ? 'Clean' : 'Passes'} — ${summary}.`)
      : chalk.red(`${summary}${failedBy(report)}.`)
  );

  return lines.join('\n');
};

/** The project to lint, or why there is none — said. */
const projectToLint = async (): Promise<{ root: string; name: string; mode: 'server' | 'client' } | undefined> => {
  const project = await projectHere('whose space to lint');
  if (!project) {
    return undefined;
  }

  const legacy = await blockingLegacy(project.root);
  if (legacy.length > 0) {
    fail(
      `The project is laid out as an older CLI left it (${legacy.map(place => place.found).join(', ')}): \`plitzi doctor --fix\` moves it to where lint reads the space, ${SPACE_DIR}/.`
    );

    return undefined;
  }

  if (project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail(
      `plitzi lint reads a space written in the project — ${SPACE_ENTRY}, as \`plitzi create --source local\` writes it. A space kept on Plitzi is read in the builder or over the MCP.`
    );

    return undefined;
  }

  const root = await fs.realpath(project.root);
  const name = (await readPackageJson(root))?.name ?? path.basename(root);

  return { root, name, mode: project.plitzi.mode };
};

export const lint = async (options: LintOptions): Promise<void> => {
  const project = await projectToLint();
  if (!project) {
    return;
  }

  const { root, name, mode } = project;
  const ts = loadTypeScript(root);
  const source = ts
    ? await lintSpaceSource(ts, {
        root,
        entry: SPACE_ENTRY,
        spaceDir: SPACE_DIR,
        dataDir: mode === 'server' ? DATA_DIR : 'public/data',
        excluded: ['src/plugins', DATA_DIR, 'vendor']
      })
    : {
        findings: [
          finding(
            'source-unreadable',
            'The project installs no TypeScript, which lint reads the source with: install the project’s dependencies (`plitzi doctor` says what is missing).'
          )
        ],
        files: 0
      };
  const findings = [...source.findings, ...(await authoringFindings(root))];
  const report = reportOf({ root, name, entry: SPACE_ENTRY, files: source.files }, findings, {
    strict: Boolean(options.strict),
    maxWarnings: options.maxWarnings
  });
  console.log(options.json ? JSON.stringify(report) : reportText(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
};
