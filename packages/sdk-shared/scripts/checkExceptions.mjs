import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import ts from 'typescript';

/**
 * Every exception to the workspace's rules, counted per package — `eslint-disable`, an `any`, an `as unknown as` — in
 * what a package ships (not its tests, stories or benchmarks), held to `exceptions.json` (`yarn check:exceptions`).
 *
 * Each is allowed only with a comment that says why there is no alternative (AGENTS.md § How we work). The table is a
 * ratchet: a count that rises fails — remove the new one, or say why it cannot go and raise the table in the same
 * change — and one that falls fails too, until the table is lowered to it, so what was removed cannot come back unseen.
 */

const SELF = fileURLToPath(import.meta.url);
const WORKSPACE = path.resolve(path.dirname(SELF), '../../..');
const TABLE = path.join(path.dirname(SELF), 'exceptions.json');
const SKIP = new Set(['node_modules', 'dist', '.turbo', 'coverage', 'tests', '__mocks__']);
const SOURCE = /\.(m?ts|tsx)$/;
const NOT_SHIPPED = /\.(test|spec|stories|bench)\.[cm]?tsx?$|\.d\.ts$/;
const KINDS = {
  disable: /eslint-disable/g,
  any: /(?::\s*any\b|<any>|\bas any\b|\bany\[\]|Array<any>)/g,
  unknownAs: /\bas unknown as\b/g
};

// What a type is written in, not what a comment or a string says: "the other way: any difference" in a comment and
// 'The page scrolls as any page does.' in a label are prose, not an `any`. Read as TypeScript reads it — a regex cannot
// tell a template's closing backtick from a string's opening, and one emptied code that was there — every comment, every
// string, the literal parts of a template and a JSX text are blanked; what is between a template's `${}` stays.
const PROSE = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText
]);

export const codeOf = (text, fileName = 'file.ts') => {
  // As its extension says: a `.ts` file read as TSX takes a generic `<D, A>(…)` for a tag, and its "text" for prose.
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, kind);
  const blanks = [];
  const visit = node => {
    const start = node.getStart(source);
    if (PROSE.has(node.kind)) {
      blanks.push([start, node.end]);
    }

    for (const comment of ts.getLeadingCommentRanges(text, node.pos) ?? []) {
      blanks.push([comment.pos, comment.end]);
    }

    node.getChildren(source).forEach(visit);
  };
  visit(source);
  for (const comment of ts.getLeadingCommentRanges(text, source.endOfFileToken.pos) ?? []) {
    blanks.push([comment.pos, comment.end]);
  }

  // UTF-16 units, as the parser's positions count: by code points, an emoji moved every blank after it.
  const chars = text.split('');
  for (const [from, to] of blanks) {
    for (let index = from; index < to; index += 1) {
      if (chars[index] !== '\n') {
        chars[index] = ' ';
      }
    }
  }

  return chars.join('');
};

const filesOf = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (SKIP.has(entry.name)) {
      return [];
    }

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return filesOf(full);
    }

    return SOURCE.test(entry.name) && !NOT_SHIPPED.test(entry.name) ? [full] : [];
  });

export const countExceptions = () => {
  const counts = {};
  for (const root of ['apps', 'packages']) {
    for (const name of fs.readdirSync(path.join(WORKSPACE, root)).sort()) {
      const src = path.join(WORKSPACE, root, name, 'src');
      if (!fs.existsSync(src)) {
        continue;
      }

      const total = { disable: 0, any: 0, unknownAs: 0 };
      for (const file of filesOf(src)) {
        const text = fs.readFileSync(file, 'utf8');
        const code = codeOf(text, file);
        for (const [kind, pattern] of Object.entries(KINDS)) {
          // A disable is a comment by its nature; every other exception is counted in the code alone.
          total[kind] += (kind === 'disable' ? text : code).match(pattern)?.length ?? 0;
        }
      }

      counts[`${root}/${name}`] = total;
    }
  }

  return counts;
};

if (process.argv[1] === SELF) {
  const counts = countExceptions();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(TABLE, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`Wrote ${path.relative(WORKSPACE, TABLE)}.`);
    process.exit(0);
  }

  const table = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
  const problems = [];
  for (const [pkg, total] of Object.entries(counts)) {
    for (const [kind, count] of Object.entries(total)) {
      const allowed = table[pkg]?.[kind] ?? 0;
      if (count > allowed) {
        problems.push(
          `${pkg}: ${String(count)} ${kind}, past the ${String(allowed)} of exceptions.json — remove the new one, or say in a comment why there is no alternative and raise the table`
        );
      } else if (count < allowed) {
        problems.push(
          `${pkg}: ${String(count)} ${kind}, under the ${String(allowed)} of exceptions.json — lower the table to it (node packages/sdk-shared/scripts/checkExceptions.mjs --write)`
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(`Exceptions to the rules moved:\n${problems.map(line => `- ${line}`).join('\n')}`);
    process.exit(1);
  }

  console.log('Every package holds the exceptions exceptions.json says.');
}
