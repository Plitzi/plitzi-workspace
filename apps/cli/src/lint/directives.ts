import type { LintFinding, SpaceSourceFile } from './types';

/**
 * What the source says not to report, eslint's way: `// plitzi-lint-disable colour-not-token` anywhere in a file for the
 * whole file, `// plitzi-lint-disable-next-line positional-id` for the line under it, `-line` for its own. No codes:
 * every rule. Text after `--` is the reason, for the reader. A practice the author departs from on purpose is said so
 * where it is — never by turning the rule off for the project.
 */
const DIRECTIVE = /plitzi-lint-disable(-next-line|-line)?(?:[ \t]+([^\n*]*?))?[ \t]*(?:\*\/|$)/gm;

interface Disabled {
  /** Codes off for the whole file; empty with `all`. */
  file: { all: boolean; codes: Set<string> };
  /** By line, from 1: the codes off on it, or `all`. */
  lines: Map<number, Set<string> | 'all'>;
}

const codesOf = (written: string | undefined): Set<string> | 'all' => {
  const codes = (written ?? '')
    .split('--')[0]
    .split(/[\s,]+/)
    .filter(Boolean);

  return codes.length === 0 ? 'all' : new Set(codes);
};

/** One `plitzi-lint-disable` comment: where it is written, what it reaches and the codes it names. */
export interface Directive {
  /** From 1, as a finding's. */
  line: number;
  column: number;
  /** `file` for the whole file; otherwise the one line it is about. */
  scope: 'file' | 'line' | 'next-line';
  codes: Set<string> | 'all';
}

export const directivesIn = (text: string): Directive[] =>
  [...text.matchAll(DIRECTIVE)].map(match => {
    const before = text.slice(0, match.index);
    const scope = match.at(1);

    return {
      line: before.split('\n').length,
      column: match.index - before.lastIndexOf('\n'),
      scope: scope === undefined ? 'file' : scope === '-next-line' ? 'next-line' : 'line',
      codes: codesOf(match.at(2))
    };
  });

const directivesOf = (text: string): Disabled => {
  const disabled: Disabled = { file: { all: false, codes: new Set() }, lines: new Map() };
  for (const { line, scope, codes } of directivesIn(text)) {
    if (scope !== 'file') {
      disabled.lines.set(scope === 'next-line' ? line + 1 : line, codes);
    } else if (codes === 'all') {
      disabled.file.all = true;
    } else {
      codes.forEach(code => disabled.file.codes.add(code));
    }
  }

  return disabled;
};

/**
 * The findings the source did not say to leave out. Only this command's own: what authoring suggests is quieted on the
 * element (`quiet: ['repeated-shape']`), where the builder and the MCP read it too — a comment naming one is a finding
 * of its own (`disable-names-suggestion`).
 */
export const withoutDisabled = (findings: readonly LintFinding[], files: readonly SpaceSourceFile[]): LintFinding[] => {
  const byFile = new Map(files.map(source => [source.file, directivesOf(source.text)]));

  return findings.filter(found => {
    const disabled = found.origin !== 'source' || found.file === undefined ? undefined : byFile.get(found.file);
    if (!disabled) {
      return true;
    }

    if (disabled.file.all || disabled.file.codes.has(found.code)) {
      return false;
    }

    const onLine = found.line === undefined ? undefined : disabled.lines.get(found.line);

    return onLine === undefined || (onLine !== 'all' && !onLine.has(found.code));
  });
};
