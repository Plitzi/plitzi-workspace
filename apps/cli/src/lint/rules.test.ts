/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { lintSpaceSource } from '.';

import type { LintFinding } from '.';

/**
 * The source rules on their own, against files written for each case: what each finds, and — as much — what each
 * leaves alone, since a rule that cries wolf is a rule turned off.
 */

let root = '';

const lintFiles = async (files: Record<string, string>): Promise<LintFinding[]> => {
  for (const [file, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }

  const { findings } = await lintSpaceSource(ts, {
    root,
    entry: 'src/space/index.ts',
    spaceDir: 'src/space',
    dataDir: 'src/data',
    excluded: ['src/plugins', 'src/data']
  });

  return findings;
};

/** The space's entry, importing every other file given so each is part of the space. */
const entryFor = (others: string[]): string =>
  `${others.map(file => `import './${path.relative('src/space', file)}';`).join('\n')}\nexport const space = { name: 'S', permanentUrl: 's', pages: [] };\n`;

const lintOne = (file: string, text: string): Promise<LintFinding[]> =>
  lintFiles({ 'src/space/index.ts': entryFor([file]), [file]: text });

const at = (findings: LintFinding[], code: string): (number | undefined)[] =>
  findings.filter(each => each.code === code).map(each => each.line);

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-lint-rules-')));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('colour-not-token', () => {
  it('finds a colour in a value, named ones only where a colour is all a property takes', async () => {
    const findings = await lintOne(
      'src/space/card.ts',
      [
        "export const a = { border: '1px solid #e5e5e5' };",
        "export const b = { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)' };",
        "export const c = { color: 'white' };",
        "export const d = { content: 'white' };"
      ].join('\n')
    );

    expect(at(findings, 'colour-not-token')).toEqual([1, 2, 3]);
    expect(findings.find(each => each.line === 2)?.message).toContain('`rgba(0, 0, 0, 0.1)`');
  });

  it('leaves alone where colours are declared, anchors, masks, markup and addresses', async () => {
    const findings = await lintOne(
      'src/space/tokens.ts',
      [
        "export const variables = { color: { bg: { light: '#ffffff', dark: '#000000' }, shade: 'rgba(0,0,0,.2)' } };",
        "export const palette = { brand: { light: '#ff0066', dark: '#ff3388', default: '#ff0066' } };",
        "export const link = { href: '#add' };",
        "export const fade = { maskImage: 'linear-gradient(#000, transparent)' };",
        "export const RING_MASK = 'radial-gradient(#000 50%, transparent 51%)';",
        'export const icon = \'<svg><path fill="#fff"/></svg>\';',
        "export const photo = 'https://example.com/a.png#fff';",
        "export const meta = { themeColor: '#101010' };"
      ].join('\n')
    );

    expect(at(findings, 'colour-not-token')).toEqual([]);
  });
});

describe('pages-in-one-file', () => {
  const pageOf = (name: string, lines: number): string =>
    `  { name: '${name}', slug: '${name}', body: [\n${Array.from({ length: lines }, () => '    child(),').join('\n')}\n  ] }`;

  it('leaves alone a family of two pages, a factory, and articles that have a slug and a body', async () => {
    const findings = await lintOne(
      'src/space/pages/journal.ts',
      [
        'const child = () => ({});',
        `export const pages = [\n${pageOf('journal', 60)},\n${pageOf('article', 60)}\n];`,
        'export const page = (name: string) => ({ name, slug: name, body: [child()] });',
        "export const articles = [{ name: 'a', slug: 'a', body: [{ heading: 'H', paragraphs: ['p'] }] }];"
      ].join('\n')
    );

    expect(at(findings, 'pages-in-one-file')).toEqual([]);
  });

  it('finds a site’s pages in one file', async () => {
    const findings = await lintOne(
      'src/space/pages/all.ts',
      `const child = () => ({});\nexport const pages = [\n${['home', 'about', 'shop'].map(name => pageOf(name, 60)).join(',\n')}\n];`
    );

    expect(at(findings, 'pages-in-one-file')).toEqual([3]);
  });
});

describe('inline-records', () => {
  const rows = (count: number): string =>
    Array.from({ length: count }, (_, index) => `  { id: 'r${String(index)}', title: 'Row ${String(index)}' }`).join(
      ',\n'
    );

  it('finds rows a page renders, given as items or mapped, wherever the list is mapped', async () => {
    const findings = await lintFiles({
      'src/space/index.ts': entryFor(['src/space/data.ts', 'src/space/page.ts']),
      'src/space/data.ts': `export const FAQ = [\n${rows(10)}\n] as const;\n`,
      'src/space/page.ts': [
        "import { FAQ as QUESTIONS } from './data.ts';",
        'export const faq = QUESTIONS.map(row => row.title);',
        `export const list = { items: [\n${rows(10)}\n] };`
      ].join('\n')
    });

    expect(findings.filter(each => each.code === 'inline-records').map(each => [each.file, each.line])).toEqual([
      ['src/space/data.ts', 1],
      ['src/space/page.ts', 3]
    ]);
  });

  it('leaves alone a short list, a lookup table nothing renders, and what the space declares', async () => {
    const findings = await lintOne(
      'src/space/table.ts',
      [
        `export const SHORT = [\n${rows(9)}\n];`,
        'SHORT.map(row => row.id);',
        `export const LOOKUP = [\n${rows(12)}\n];`,
        `export const config = { fonts: [\n${rows(12)}\n] };`,
        'config.fonts.map(font => font.id);'
      ].join('\n')
    );

    expect(at(findings, 'inline-records')).toEqual([]);
  });
});

describe('special-case-in-map', () => {
  it('finds a row singled out by its identity — compared, destructured or switched on', async () => {
    const findings = await lintOne(
      'src/space/menu.ts',
      [
        'declare const ROWS: { id: string; kind: string; title: string }[];',
        "export const a = ROWS.map(row => (row.id === 'team' ? 'Team' : row.title));",
        "export const b = ROWS.map(({ id, title }) => (id !== 'docs' ? title : 'Docs'));",
        "export const c = ROWS.map(row => { switch (row.slug) { case 'x': return 1; default: return 0; } });",
        "export const d = ROWS.map(row => (row.kind === 'video' ? 1 : 0));",
        'export const e = ROWS.map(row => ROWS.filter(other => other.id === row.id).length);'
      ].join('\n')
    );

    expect(at(findings, 'special-case-in-map')).toEqual([2, 3, 4]);
  });
});

describe('positional-id', () => {
  it('finds the names minted for elements nobody named, and only those', async () => {
    const findings = await lintOne(
      'src/space/ids.ts',
      [
        "export const a = { id: 'container-45' };",
        "export const b = { id: 'heading-a7k2' };",
        "export const c = { id: 'text-main' };",
        "export const d = { id: 'hero-2' };",
        "export const e = { id: 'home-container-3' };"
      ].join('\n')
    );

    expect(at(findings, 'positional-id')).toEqual([1, 2]);
  });
});

describe('repeated-css', () => {
  it('finds the same CSS three times in any spelling and order, and not two copies or a pair of values', async () => {
    const findings = await lintFiles({
      'src/space/index.ts': entryFor(['src/space/a.ts', 'src/space/b.ts']),
      'src/space/a.ts': [
        "export const a = { display: 'flex', gap: '8px', alignItems: 'center' };",
        "export const b = { 'align-items': 'center', display: 'flex', gap: '8px' };",
        "export const c = { display: 'grid', gap: '8px' };",
        "export const d = { display: 'grid', gap: '8px' };"
      ].join('\n'),
      'src/space/b.ts': [
        "export const e = { gap: '8px', display: 'flex', alignItems: 'center' };",
        "export const f = { display: 'grid', gap: '8px' };"
      ].join('\n')
    });

    const repeated = findings.filter(each => each.code === 'repeated-css');

    expect(repeated).toMatchObject([{ file: 'src/space/a.ts', line: 1 }]);
    expect(repeated[0].others).toEqual([
      { file: 'src/space/a.ts', line: 2, column: 18 },
      { file: 'src/space/b.ts', line: 1, column: 18 }
    ]);
  });
});

describe('the source’s say', () => {
  it('turns a rule off for a whole file, and says a file nothing imports', async () => {
    const findings = await lintFiles({
      'src/space/index.ts': entryFor(['src/space/brand.ts']),
      'src/space/brand.ts':
        "// plitzi-lint-disable colour-not-token -- partners' logos, in their own colours\nexport const a = { color: '#ff0000' };\nexport const b = { id: 'text-4' };\n",
      'src/space/old.ts': 'export const old = 1;\n',
      'src/space/old.test.ts': 'export const test = 1;\n'
    });

    expect(findings.map(each => [each.code, each.file])).toEqual([
      ['unused-file', 'src/space/old.ts'],
      ['positional-id', 'src/space/brand.ts']
    ]);
  });
});
