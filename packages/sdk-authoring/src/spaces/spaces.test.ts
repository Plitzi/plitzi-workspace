/* eslint-disable quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  blankSpace,
  blankSpaceSpec,
  blankTemplateFiles,
  emptyTemplateFiles,
  emptySpaceSpec,
  toPortableSource
} from './index';
import { custom } from '../elements';
import * as authoring from '../index';
import { authorSpace, validateSpace } from '../schema';

import type { SpaceSpec } from '../schema';

/** The copy's entry, which holds the page, the name and any plugin it hosts. */
const blankEntry = (options: Parameters<typeof blankTemplateFiles>[0] = {}): string =>
  blankTemplateFiles(options)['src/space/index.ts'];

/** Every file of the copy, as one text: what is true of all of them. */
const blankCopy = (): string => Object.values(blankTemplateFiles()).join('\n');

/**
 * The document two unrelated things start a space from — the platform's `POST /spaces` and `plitzi create` — so
 * what is asserted is that it is a space at all, that it renders as something rather than nothing, and that the
 * copy handed to a project is a file that project can actually compile.
 */

describe('spaces/blank', () => {
  it('authors a valid space document', () => {
    const { schema, style, warnings } = blankSpace();

    expect(validateSpace({ schema, style }).valid).toBe(true);
    expect(warnings).toEqual([]);
  });

  /** A blank canvas is the hardest possible first minute. This one is meant to render as something. */
  it('has a page with content on it', () => {
    const { schema } = blankSpace();

    // And the page of every address no other page answers, which goes back to it.
    expect(schema.pages).toEqual(['home', 'not-found']);
    expect(Object.keys(schema.flat).length).toBeGreaterThan(10);
  });

  it('carries the style the page is drawn with', () => {
    const { style } = blankSpace();

    expect(style.cache).not.toBe('');
    expect(style.theme).toEqual({ default: 'system', schemes: ['light', 'dark'] });
  });

  it('hands out a fresh copy each time', () => {
    const first = blankSpace();
    first.schema.definition = { name: 'Mine', permanentUrl: 'mine' };

    expect(blankSpace().schema.definition).not.toEqual(first.schema.definition);
  });

  /** The first page anybody sees is a way into the docs, and a card that goes nowhere is a dead end on that page. */
  it('links every card and button somewhere real', () => {
    const { schema } = blankSpace();
    const links = Object.values(schema.flat).filter(
      element => element.definition.type === 'link' && element.definition.rootId === 'home'
    );

    expect(links.length).toBeGreaterThan(6);
    for (const element of links) {
      expect(element.attributes.href).toMatch(/^https:\/\/plitzi\.com(\/docs(\/[a-z-]+)?)?$/);
      // A link with no mode is read as a page of this space, and plitzi.com is not one.
      expect(element.attributes.mode).toBe('external');
    }
  });

  /** Named so a test, a binding or an agent can point at them; the rest are positional and free to move. */
  it('names the elements worth pointing at', () => {
    const { handles } = blankSpace();
    const named = Object.values(handles.page('').elements)
      .filter(handle => handle.named)
      .map(handle => handle.id)
      .sort();

    expect(named).toContain('hero-title');
    expect(named).toContain('cards');
    expect(named).toContain('concepts-title');
  });
});

/**
 * The element the copy gains is a real one.
 *
 * The transform above produces SOURCE, which nothing here can execute — so the shape it writes is authored here
 * through the same factories and put through the validator. A `custom` element whose attributes the schema
 * refuses would otherwise only be discovered by whoever ran `plitzi create` and opened the page.
 */
describe('the plugin host element', () => {
  it('authors and validates as part of a space', () => {
    const hosted: SpaceSpec = {
      ...blankSpaceSpec,
      pages: [
        {
          ...blankSpaceSpec.pages[0],
          body: [
            ...blankSpaceSpec.pages[0].body,
            custom({
              id: 'stat-card',
              renderType: 'statCard',
              settings: '{"label":"Elements","value":12}',
              css: { desktop: { 'margin-top': '24px' } }
            })
          ]
        }
      ]
    };

    const { schema, style, handles, warnings } = authorSpace(hosted);

    expect(validateSpace({ schema, style }).valid).toBe(true);
    expect(warnings).toEqual([]);
    expect(handles.page('').elements['stat-card'].type).toBe('custom');
  });
});

describe('the copy handed to a project', () => {
  it('imports from the package and from the files beside it, never from inside the package', () => {
    const files = blankTemplateFiles();

    for (const [file, source] of Object.entries(files)) {
      expect(source, file).not.toMatch(/from '\.\./);
      for (const [, sibling] of source.matchAll(/from '\.\/([^']+)'/g)) {
        expect(Object.keys(files), `${file} imports ./${sibling}`).toContain(`src/space/${sibling}`);
      }
    }

    expect(blankEntry()).toContain("from '@plitzi/sdk-authoring'");
    // Named for whoever receives it, not for the platform: the copy is somebody's own site, not Plitzi's blank one.
    expect(blankEntry()).toContain('export const space');
    expect(blankCopy()).not.toContain('blankSpaceSpec');
  });

  /** A file per part, each short enough to read whole — what `plitzi space lint` holds a project's space to. */
  it('is a file per part, each one short enough to read whole', () => {
    const files = blankTemplateFiles();

    expect(Object.keys(files)).toEqual([
      'src/space/index.ts',
      'src/space/tokens.ts',
      'src/space/theme.ts',
      'src/space/content.ts',
      'src/space/notFound.ts'
    ]);
    for (const [file, source] of Object.entries(files)) {
      expect(source.split('\n').filter(line => line.trim() !== '').length, file).toBeLessThanOrEqual(400);
    }

    expect(Object.keys(blankTemplateFiles({ dir: 'preview/space' }))).toContain('preview/space/index.ts');
  });

  /**
   * What `plitzi create` starts a project with and what signing up gives an account cannot come apart: the copy, run
   * as the project runs it, authors the very documents the platform's space does.
   */
  it('authors, as copied, the documents the platform starts a space with', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-blank-copy-'));
    try {
      for (const [file, source] of Object.entries(blankTemplateFiles())) {
        await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
        await fs.writeFile(path.join(dir, file), source);
      }

      const copy: unknown = await import(pathToFileURL(path.join(dir, 'src/space/index.ts')).href);
      const spec: unknown = typeof copy === 'object' && copy !== null ? Reflect.get(copy, 'space') : undefined;
      const { schema, style } = blankSpace();
      // The module is the copy written just above, which exports the space as `space`.
      const authored = authorSpace(spec as SpaceSpec);

      expect(JSON.stringify({ schema: authored.schema, style: authored.style })).toBe(
        JSON.stringify({ schema, style })
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  /**
   * The copy is the example an agent writes the rest of the space after, so it follows the skill's own rules: a box
   * one rule set owns whole is a shorthand (`padding: '6px 10px'`), not its four sides written apart.
   */
  it('writes a box one rule set owns as a shorthand', () => {
    const groups = {
      padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
      margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
      border: ['border-width', 'border-style', 'border-color']
    };
    // The innermost `{ … }` of the source: one rule set each.
    const ruleSets = blankCopy().match(/\{[^{}]*\}/g) ?? [];
    const spelledOut = ruleSets.flatMap(rules =>
      Object.entries(groups)
        .filter(([, longhands]) => longhands.every(longhand => rules.includes(`'${longhand}'`)))
        .map(([shorthand]) => `${shorthand} in ${rules.replace(/\s+/g, ' ')}`)
    );

    expect(spelledOut).toEqual([]);
  });

  /** The whole file has to survive, not just its header — the rewrite is of imports, not of the declaration. */
  it('keeps everything below the imports', () => {
    expect(blankEntry()).toContain(blankSpaceSpec.pages[0].name);
    expect(blankCopy().split('\n').length).toBeGreaterThan(700);
  });

  /**
   * The names the copy imports are names the package exports.
   *
   * The one assertion that catches the failure this whole path exists to prevent: the declaration is free to use
   * anything inside the package, and the copy can only use what is on the public entry. Moving a factory to a
   * module that is not re-exported writes a project that does not compile, and nothing else here would say so.
   */
  it('imports only names the package actually exports', () => {
    const names = [...blankCopy().matchAll(/^import \{([^}]*)\} from '@plitzi\/sdk-authoring';$/gm)].flatMap(match =>
      match[1].split(',').map(entry => entry.trim())
    );

    expect(names.length).toBeGreaterThan(5);
    for (const name of names) {
      expect(authoring, `@plitzi/sdk-authoring exports ${name}`).toHaveProperty(name);
    }
  });

  /** The receiver's name goes in here, so the scaffold never has to know which literals this file contains. */
  it('renames the copy, and slugs the url it derives ids from', () => {
    const source = blankEntry({ name: 'My Site' });

    expect(source).toContain("name: 'My Site'");
    // A DNS label at the platform, and what every element id and selector is derived from.
    expect(source).toContain("permanentUrl: 'my-site'");
    expect(Object.values(blankTemplateFiles({ name: 'My Site' })).join('\n')).not.toContain(
      blankSpaceSpec.permanentUrl
    );
  });

  /**
   * The plugin slot is asked for, never assumed.
   *
   * The platform authors a new space from this same declaration and hosts nobody's plugins, so a `custom` element
   * in the default would render "Not Found" on every space anyone ever signed up for.
   */
  it('hosts a plugin only when asked, and never in the space the platform authors', () => {
    const plain = blankCopy();
    const hosted = blankEntry({
      plugin: { id: 'stat-card', renderType: 'statCard', attributes: { label: "Today's", series: [1, 2] } }
    });

    expect(plain).not.toContain('custom(');
    expect(hosted).toContain("renderType: 'statCard'");
    expect(hosted).toContain("id: 'stat-card'");
    // Attributes, which the component receives as props — written as source a person reads, quoted the way the
    // project's Prettier would: an apostrophe in the text takes double quotes rather than an escape.
    expect(hosted).toContain('label: "Today\'s"');
    expect(hosted).toContain('series: [1, 2]');
    // Prepended as its own line, then folded into the package import by the rewrite below.
    expect(hosted).toMatch(/^import \{[^}]*\bcustom\b[^}]*\} from '@plitzi\/sdk-authoring';$/m);
    expect(hosted).not.toMatch(/from '\.\./);
  });

  /** How a published space hosts a plugin it loads from a manifest, and how the builder adds one: by its own type. */
  it('hosts a plugin as an element of its own type when asked', () => {
    const hosted = blankEntry({
      plugin: { id: 'seat-picker', renderType: 'seatPicker', as: 'element', attributes: { start: 3 } }
    });

    expect(hosted).toContain("element('seatPicker', {");
    expect(hosted).not.toContain('custom(');
    expect(hosted).not.toContain('renderType');
    expect(hosted).toMatch(/^import \{[^}]*\belement\b[^}]*\} from '@plitzi\/sdk-authoring';$/m);
  });

  it('hosts every plugin of a list, one after another', () => {
    const hosted = blankEntry({
      plugin: [
        { id: 'seat-picker', renderType: 'seatPicker', as: 'element', attributes: {} },
        { id: 'legend', renderType: 'legend', as: 'element', attributes: { label: 'Key' } }
      ]
    });

    expect(hosted).toContain("element('seatPicker', {");
    expect(hosted).toContain("element('legend', {");
    expect(hosted.indexOf("element('seatPicker'")).toBeLessThan(hosted.indexOf("element('legend'"));
  });

  it('feeds the plugin from a data file when asked, through a provider and a binding', () => {
    const hosted = blankEntry({
      plugin: {
        id: 'stat-card',
        renderType: 'statCard',
        attributes: { label: 'Requests today' },
        data: { id: 'stats', query: '/data/stats.json', bind: { value: 'stats.data.value' } }
      }
    });

    expect(hosted).toContain("query: '/data/stats.json'");
    expect(hosted).toContain("bind: { value: 'stats.data.value' }");
    expect(hosted).toMatch(/^import \{[^}]*\bapiContainer\b[^}]*\} from '@plitzi\/sdk-authoring';$/m);
  });

  /** Prettier wraps a long import across lines; a rewrite that only reads one-liners would drop the names. */
  it('rewrites an import however it is wrapped', () => {
    const rewritten = toPortableSource(
      ['import {', '  container,', '  heading', "} from '../../elements';", '', 'const x = 1;', ''].join('\n')
    );

    expect(rewritten).toBe(
      ["import { container, heading } from '@plitzi/sdk-authoring';", '', 'const x = 1;', ''].join('\n')
    );
  });

  /** A file copied beside it travels with it: its import is kept as written, after the package's. */
  it('keeps an import of a file beside it, as its formatter wrapped it', () => {
    const rewritten = toPortableSource(
      [
        "import { styles } from '../../style';",
        '',
        "import { a } from './content.ts';",
        'import {',
        '  b,',
        '  c',
        "} from './theme.ts';",
        '',
        "import type { T } from './content.ts';",
        "import type { S } from '../../schema';",
        '',
        'const x = 1;',
        ''
      ].join('\n')
    );

    expect(rewritten).toBe(
      [
        "import { styles } from '@plitzi/sdk-authoring';",
        '',
        "import { a } from './content.ts';",
        'import {',
        '  b,',
        '  c',
        "} from './theme.ts';",
        '',
        "import type { S } from '@plitzi/sdk-authoring';",
        "import type { T } from './content.ts';",
        '',
        'const x = 1;',
        ''
      ].join('\n')
    );
  });

  /** Anything it cannot point at the package is a broken copy, so it is refused rather than written. */
  it('refuses a relative import it cannot rewrite', () => {
    expect(() => toPortableSource("import spec from '../blank/spec';\n\nconst x = 1;\n")).toThrow(/cannot rewrite/);
    expect(() => toPortableSource("const x = 1;\n\nexport { y } from '../y';\n")).toThrow(/still refers/);
    expect(() => toPortableSource("const x = 1;\n\nexport { y } from './';\n")).not.toThrow();
    expect(() => toPortableSource("const x = 1;\n\nexport { y } from '.';\n")).toThrow(/still refers/);
  });

  /** Laid out as the project's formatter would, so a new project's first lint has nothing to say about it. */
  it('wraps an import that would not fit the print width', () => {
    const names = Array.from({ length: 12 }, (_, index) => `factoryNumber${index}`);
    const rewritten = toPortableSource(`import { ${names.join(', ')} } from '../../elements';\n\nconst x = 1;\n`);
    const [first, ...rest] = rewritten.split('\n');

    expect(first).toBe('import {');
    expect(rest.slice(0, 12)).toEqual([...names].sort().map((name, index) => `  ${name}${index < 11 ? ',' : ''}`));
    expect(rest[12]).toBe("} from '@plitzi/sdk-authoring';");
    expect(rewritten.split('\n').every(line => line.length <= 120)).toBe(true);
  });

  it('merges every relative import into one, values and types apart', () => {
    const rewritten = toPortableSource(
      [
        "import { b, a } from '../../elements';",
        "import { c } from '../../style';",
        '',
        "import type { T } from '../../schema';",
        '',
        'const x = 1;',
        ''
      ].join('\n')
    );

    expect(rewritten).toBe(
      [
        "import { a, b, c } from '@plitzi/sdk-authoring';",
        '',
        "import type { T } from '@plitzi/sdk-authoring';",
        '',
        'const x = 1;',
        ''
      ].join('\n')
    );
  });
});

/** `plitzi create --template blank`: what a project about to be something specific starts from. */
describe('spaces/empty', () => {
  it('authors a valid space with no warning: tokens, a layout and a page in it', () => {
    const { schema, style, warnings } = authorSpace(emptySpaceSpec);

    expect(validateSpace({ schema, style }).valid).toBe(true);
    expect(warnings).toEqual([]);
    expect(schema.pages).toEqual(['home', 'not-found']);
  });
});

/** The first `npm run author` of a new project is what it learns the space's idiom from: nothing to suggest. */
describe('a new project’s space', () => {
  it.each([
    ['welcome', blankSpaceSpec],
    ['blank', emptySpaceSpec]
  ])('%s authors, as a project authors it, with nothing to suggest', (_template, spec) => {
    const { suggestions } = authoring.authorSpace(spec);

    expect(suggestions.map(suggestion => `${suggestion.code}: ${suggestion.message}`)).toEqual([]);
  });

  it('is handed out as files under the project’s name, importing only what the package exports', () => {
    const files = emptyTemplateFiles({ name: 'My Shop' });

    expect(Object.keys(files)).toEqual(['src/space/index.ts', 'src/space/notFound.ts']);
    expect(files['src/space/index.ts']).toContain("name: 'My Shop'");
    expect(files['src/space/index.ts']).toContain("permanentUrl: 'my-shop'");
    for (const source of Object.values(files)) {
      const match = /^import \{([^}]*)\} from '@plitzi\/sdk-authoring';$/m.exec(source);

      expect(source).not.toMatch(/from '\.\./);
      for (const name of (match?.[1] ?? '').split(',').map(entry => entry.trim())) {
        expect(authoring, `@plitzi/sdk-authoring exports ${name}`).toHaveProperty(name);
      }
    }
  });
});
