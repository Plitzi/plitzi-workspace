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

const directivesOf = (text: string): Disabled => {
  const disabled: Disabled = { file: { all: false, codes: new Set() }, lines: new Map() };
  for (const match of text.matchAll(DIRECTIVE)) {
    const line = text.slice(0, match.index).split('\n').length;
    const codes = codesOf(match.at(2));
    const scope = match.at(1);
    if (scope === undefined) {
      if (codes === 'all') {
        disabled.file.all = true;
      } else {
        codes.forEach(code => disabled.file.codes.add(code));
      }
    } else {
      disabled.lines.set(scope === '-next-line' ? line + 1 : line, codes);
    }
  }

  return disabled;
};

/**
 * The findings the source did not say to leave out. Only this command's own: what authoring suggests is quieted on the
 * element (`quiet: ['repeated-shape']`), where the builder and the MCP read it too.
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
