/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authorSpace, container, styles } from '@plitzi/sdk-authoring';

import { lint } from '.';
import create from '../commands/create';

import type { LintFinding, LintOptions, LintReport } from '.';

/**
 * `plitzi space lint` on a project `plitzi create` wrote: a space as written is clean, and each practice the source departs
 * from is said at its file and line — beside what authoring suggests, whatever its code.
 */

let home = '';
let project = '';
let said: string[] = [];

const write = async (file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(project, file)), { recursive: true });
  await fs.writeFile(path.join(project, file), text);
};

/** A package of this workspace, as an install leaves it: linked, so the project's own imports resolve to it. */
const link = async (name: string, from: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(project, 'node_modules', name)), { recursive: true });
  await fs.symlink(path.resolve(import.meta.dirname, from), path.join(project, 'node_modules', name), 'dir');
};

const linkPackages = async (): Promise<void> => {
  await link('@plitzi/sdk-authoring', '../../../../packages/sdk-authoring');
  await link('typescript', '../../../../node_modules/typescript');
};

const run = async (options: Omit<LintOptions, 'json'> = {}): Promise<LintReport> => {
  said = [];
  process.exitCode = undefined;
  await lint({ json: true, ...options });
  const parsed: unknown = JSON.parse(said.at(-1) ?? '{}');

  // The report is the command's own JSON, written just above: its shape is `LintReport`.
  return parsed as LintReport;
};

const codes = (report: LintReport): string[] => report.findings.map(each => each.code);

const only = (report: LintReport, code: string): LintFinding[] => report.findings.filter(each => each.code === code);

/** A space whose index assembles what `src/space/pages/home.ts` writes, as the source to add to. */
const SPACE_INDEX = `import { home } from './pages/home.ts';

// The page for an address nothing answers, written: authoring has none of its own to add and suggest.
const notFound = { name: 'Not found', slug: '*', body: [] };

export const space = { name: 'Lint', permanentUrl: 'lint', pages: [home, notFound] };
`;

const page = (body: string, imports = "import { container, heading, text } from '@plitzi/sdk-authoring';"): string =>
  `${imports}\n\nexport const home = {\n  name: 'Home',\n  slug: '',\n  isDefault: true,\n  body: [\n${body}\n  ]\n};\n`;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-lint-'));
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => said.push(String(line)));
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => said.push(String(line)));
  // A space of one file, which each case writes over with its own.
  await create(path.join(home, 'site'), {
    mode: 'server',
    source: 'local',
    packageManager: 'npm',
    install: false,
    template: 'blank'
  });
  project = path.join(home, 'site');
  // The template's page for an unknown address sits in its layout, which no case here writes: each space is its own.
  await fs.rm(path.join(project, 'src/space/notFound.ts'));
  vi.spyOn(process, 'cwd').mockReturnValue(project);
  await linkPackages();
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await fs.rm(home, { recursive: true, force: true });
});

describe('plitzi space lint', () => {
  it('finds a space as plitzi create wrote it clean, and says what it does not check', async () => {
    for (const template of ['welcome', 'blank', 'catalog']) {
      await fs.rm(project, { recursive: true, force: true });
      await create(project, { mode: 'server', source: 'local', packageManager: 'npm', install: false, template });
      await linkPackages();

      const report = await run();
      // What authoring suggests about a template is authoring's to keep at none; the source's practices are this one's.
      const ofSource = report.findings.filter(each => each.origin === 'source');

      expect({ template, findings: ofSource }).toEqual({ template, findings: [] });
      expect(report.counts.error).toBe(0);
      expect(process.exitCode).toBeUndefined();
      expect(report.scope).toBe('space-source');
      expect(report.notChecked.map(entry => entry.by)).toEqual([
        'npm run author',
        'plitzi page check',
        'plitzi doctor'
      ]);
      expect(report.project.files).toBeGreaterThan(0);
    }
  }, 60_000);

  it('says each practice the source departs from, at its file and line, with what to write instead', async () => {
    const records = Array.from(
      { length: 10 },
      (_, index) => `  { id: 'dish-${String(index)}', name: 'Dish ${String(index)}', price: ${String(index)} }`
    ).join(',\n');
    await write('src/space/index.ts', SPACE_INDEX);
    await write(
      'src/space/menu.ts',
      `import { container, text } from '@plitzi/sdk-authoring';\n\nexport const DISHES = [\n${records}\n];\n\n` +
        `export const menu = () =>\n  DISHES.map(dish =>\n    container({\n      id: \`menu-\${dish.id}\`,\n` +
        `      css: { display: 'flex', gap: '8px', alignItems: 'center' },\n` +
        `      children: [text(dish.id === 'dish-0' ? 'Chef’s pick' : dish.name)]\n    })\n  );\n`
    );
    await write(
      'src/space/pages/home.ts',
      page(
        [
          "    container({ id: 'container-12', css: { display: 'flex', gap: '8px', alignItems: 'center' } }),",
          "    container({ id: 'home-row', css: { display: 'flex', alignItems: 'center', gap: '8px' } }),",
          "    heading('Hi', { id: 'home-title', css: { color: '#ff0066' } }),",
          "    text('Plans', { id: 'home-plans' }),",
          '    ...menu()'
        ].join('\n'),
        "import { container, heading, text } from '@plitzi/sdk-authoring';\n\nimport { menu } from '../menu.ts';"
      )
    );
    await write('src/space/old.ts', "export const old = 'nothing imports me';\n");

    const report = await run();

    expect(only(report, 'unused-file')).toMatchObject([{ file: 'src/space/old.ts', line: 1 }]);
    expect(only(report, 'inline-records')).toMatchObject([
      { file: 'src/space/menu.ts', line: 3, severity: 'warning', origin: 'source' }
    ]);
    expect(only(report, 'inline-records')[0].message).toContain('src/data/dishes.json');
    expect(only(report, 'special-case-in-map')).toMatchObject([{ file: 'src/space/menu.ts' }]);
    expect(only(report, 'special-case-in-map')[0].message).toContain('“dish-0”');
    expect(only(report, 'colour-not-token')).toMatchObject([{ file: 'src/space/pages/home.ts', line: 12 }]);
    expect(only(report, 'positional-id')).toMatchObject([{ file: 'src/space/pages/home.ts', line: 10 }]);
    expect(only(report, 'repeated-css')).toHaveLength(1);
    expect(only(report, 'repeated-css')[0].others).toHaveLength(2);
    expect(report.findings.every(each => each.docs.length > 0)).toBe(true);
    expect(report.findings.filter(each => each.severity === 'error')).toEqual([]);
    expect(report.ok).toBe(true);
    expect(process.exitCode).toBeUndefined();
  }, 30_000);

  it('says pages written in the entry, and a file too long to read whole', async () => {
    const pageOf = (name: string): string =>
      `    {\n      name: '${name}',\n      slug: '${name.toLowerCase()}',\n      body: [\n${Array.from(
        { length: 20 },
        (_, index) => `        text('${name} ${String(index)}', { id: '${name.toLowerCase()}-${String(index)}' })`
      ).join(',\n')}\n      ]\n    }`;
    const filler = Array.from({ length: 420 }, (_, index) => `export const line${String(index)} = ${String(index)};`);
    await write(
      'src/space/index.ts',
      `import { text } from '@plitzi/sdk-authoring';\n\nimport './filler.ts';\n\nexport const space = {\n  name: 'Lint',\n  permanentUrl: 'lint',\n  pages: [\n${pageOf('Home')},\n${pageOf('About')}\n  ]\n};\n`
    );
    await write('src/space/filler.ts', `${filler.join('\n')}\n`);

    const report = await run();

    expect(only(report, 'pages-in-one-file')).toMatchObject([{ file: 'src/space/index.ts', line: 9 }]);
    expect(only(report, 'pages-in-one-file')[0].message).toContain('src/space/pages/');
    expect(only(report, 'file-too-long')).toMatchObject([{ file: 'src/space/filler.ts', line: 1 }]);
  }, 30_000);

  it('relays what authoring suggests, whatever its code, at the line that wrote the element', async () => {
    await write('src/space/index.ts', SPACE_INDEX);
    await write(
      'src/space/pages/home.ts',
      page(
        [
          "    heading('Hi', { id: 'home-title' }),",
          "    link({ id: 'home-docs', href: '/docs', children: [text('Docs', { id: 'home-docs-text' })] })"
        ].join('\n'),
        "import { heading, link, text } from '@plitzi/sdk-authoring';"
      )
    );

    const report = await run();
    const relayed = report.findings.filter(each => each.origin === 'authoring');

    expect(only(report, 'content-attribute')).toMatchObject([
      { file: 'src/space/pages/home.ts', line: 9, severity: 'warning', origin: 'authoring' }
    ]);
    expect(relayed.every(each => each.docs === `npx plitzi explain ${each.code}`)).toBe(true);
  }, 30_000);

  it('says a comment naming a suggestion silences nothing, and how a suggestion is quieted', async () => {
    await write('src/space/index.ts', SPACE_INDEX);
    await write(
      'src/space/pages/home.ts',
      page(
        [
          '    // plitzi-lint-disable-next-line content-attribute -- the words stay a text',
          "    link({ id: 'home-docs', href: '/docs', children: [text('Docs', { id: 'home-docs-text' })] })"
        ].join('\n'),
        "import { link, text } from '@plitzi/sdk-authoring';"
      )
    );

    const report = await run();

    expect(only(report, 'content-attribute')).toMatchObject([{ line: 9, origin: 'authoring' }]);
    expect(only(report, 'disable-names-suggestion')).toMatchObject([
      { file: 'src/space/pages/home.ts', line: 8, column: 8, origin: 'source' }
    ]);
    expect(only(report, 'disable-names-suggestion')[0].message).toContain("quiet: ['content-attribute']");

    said = [];
    await lint({});
    expect(said.join('\n')).toContain(
      "Authoring's suggestions (content-attribute) are quieted on the element they are about — `quiet: ['content-attribute']`"
    );
  }, 30_000);

  it('leaves authoring’s literal-colour to colour-not-token, which says each colour at its line', async () => {
    const source = [
      "import { container, styles } from '@plitzi/sdk-authoring';",
      '',
      "const card = styles('card', { backgroundColor: 'var(--surface)', color: '#f5efe6' });",
      '',
      'export const space = {',
      "  name: 'Lint',",
      "  permanentUrl: 'lint',",
      "  variables: { color: { surface: { light: '#f5efe6', dark: '#101010', default: '#f5efe6' } } },",
      "  pages: [{ name: 'Home', slug: '', isDefault: true, body: [container({ id: 'home-card', class: card })] }]",
      '};',
      ''
    ].join('\n');
    // The same space, authored here: authoring does suggest `literal-colour` for it, so leaving it out is a choice.
    const card = styles('card', { backgroundColor: 'var(--surface)', color: '#f5efe6' });
    const { suggestions } = authorSpace({
      name: 'Lint',
      permanentUrl: 'lint',
      variables: { color: { surface: { light: '#f5efe6', dark: '#101010', default: '#f5efe6' } } },
      pages: [{ name: 'Home', slug: '', isDefault: true, body: [container({ id: 'home-card', class: card })] }]
    });
    expect(suggestions.map(each => each.code)).toContain('literal-colour');
    await write('src/space/index.ts', source);

    const report = await run();

    expect(codes(report)).not.toContain('literal-colour');
    expect(only(report, 'colour-not-token')).toMatchObject([{ file: 'src/space/index.ts', line: 3 }]);
  }, 30_000);

  it('leaves out what the source says to, eslint’s way, and only that', async () => {
    await write('src/space/index.ts', SPACE_INDEX);
    await write(
      'src/space/pages/home.ts',
      page(
        [
          '    // plitzi-lint-disable-next-line colour-not-token -- the brand’s own red, the same in both themes',
          "    heading('Hi', { id: 'home-title', css: { color: '#ff0066' } }),",
          "    heading('Ho', { id: 'home-sub', css: { color: '#00ff66' } }),",
          "    text('Ha', { id: 'text-3' }) // plitzi-lint-disable-line colour-not-token"
        ].join('\n')
      )
    );

    const report = await run();

    expect(only(report, 'colour-not-token')).toMatchObject([{ line: 10 }]);
    expect(only(report, 'positional-id')).toMatchObject([{ line: 11 }]);
  }, 30_000);

  // What the space lacks has no element to quiet it on: it is answered by writing it.
  it('never offers to quiet a suggestion about what the space lacks', async () => {
    await write(
      'src/space/index.ts',
      "import { home } from './pages/home.ts';\n\nexport const space = { name: 'Lint', permanentUrl: 'lint', pages: [home] };\n"
    );
    await write('src/space/pages/home.ts', page("    heading('Hi', { id: 'home-title' })"));

    const report = await run();

    expect(only(report, 'not-found-page')).toMatchObject([{ origin: 'authoring', severity: 'warning' }]);
    expect(said.join('\n')).not.toContain("Authoring's suggestions (not-found-page)");
  }, 30_000);

  it('fails on an error; on warnings only with --strict or past --max-warnings', async () => {
    await write('src/space/index.ts', SPACE_INDEX);
    await write('src/space/pages/home.ts', page("    heading('Hi', { id: 'home-title', css: { color: '#ff0066' } })"));

    expect((await run()).ok).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect((await run({ maxWarnings: 1 })).ok).toBe(true);
    expect((await run({ maxWarnings: 0 })).ok).toBe(false);
    expect(process.exitCode).toBe(1);
    expect((await run({ strict: true })).ok).toBe(false);
    expect(process.exitCode).toBe(1);
  }, 30_000);

  it('says a space that does not author as an error, and still reads its source', async () => {
    await write('src/space/index.ts', SPACE_INDEX);
    await write(
      'src/space/pages/home.ts',
      page(
        "    heading('Hi', { id: 'home-title', css: { color: '#ff0066' } }),\n    heading('Ho', { id: 'home-title' })"
      )
    );

    const report = await run();

    expect(codes(report)).toEqual(expect.arrayContaining(['colour-not-token', 'space-does-not-author']));
    expect(only(report, 'space-does-not-author')[0]).toMatchObject({ severity: 'error', docs: 'npm run author' });
    expect(report.ok).toBe(false);
    expect(process.exitCode).toBe(1);
  }, 30_000);

  // Each error is the doctor's to say, with its fix: lint says in one line that they are there, and reads the source.
  it('points at plitzi doctor, in one line, when the project is laid out where nothing reads it', async () => {
    await write('src/plugins/Card/Card.tsx', 'export default () => null;\n');
    await write('src/plugin/Chart/index.ts', 'export default () => null;\n');
    await write('src/space/index.ts', SPACE_INDEX);
    await write('src/space/pages/home.ts', page("    heading('Hi', { css: { color: '#ff0066' } })"));

    const report = await run();

    expect(only(report, 'project-layout')).toEqual([
      expect.objectContaining({
        severity: 'error',
        docs: 'plitzi doctor',
        message:
          "The project's layout has 2 errors, which stop its server and `npm run author` — `plitzi doctor` says each and what fixes it; what authoring suggests is read once they are fixed."
      })
    ]);
    // Not one of them said here, nor authoring's refusal, which would say them all again.
    expect(JSON.stringify(report.findings)).not.toContain('src/plugins/Card');
    expect(codes(report)).not.toContain('space-does-not-author');
    expect(codes(report)).toContain('colour-not-token');
    expect(report.ok).toBe(false);
  }, 30_000);

  it('refuses a project whose space is not written in it, and one an older CLI laid out', async () => {
    await fs.rm(path.join(project, 'src/space'), { recursive: true });
    said = [];
    await lint({});
    expect(said.join('\n')).toContain('plitzi space lint reads a space written in the project');
    expect(process.exitCode).toBe(1);

    await write('src/space.ts', SPACE_INDEX);
    said = [];
    process.exitCode = undefined;
    await lint({});
    expect(said.join('\n')).toContain('plitzi doctor --fix');
    expect(process.exitCode).toBe(1);
  }, 30_000);
});
