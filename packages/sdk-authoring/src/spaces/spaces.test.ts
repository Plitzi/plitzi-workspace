/* eslint-disable quotes */
import { describe, expect, it } from 'vitest';

import { blankSpace, blankSpaceSource, blankSpaceSpec, toPortableSource } from './index';
import { custom } from '../elements';
import * as authoring from '../index';
import { authorSpace, validateSpace } from '../schema';

import type { SpaceSpec } from '../schema';

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

    expect(schema.pages).toEqual(['home']);
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
    const links = Object.values(schema.flat).filter(element => element.definition.type === 'link');

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
  it('imports from the package, not from inside it', () => {
    const source = blankSpaceSource();

    expect(source).not.toMatch(/from '\.\./);
    expect(source).toContain("from '@plitzi/sdk-authoring'");
    // Named for whoever receives it, not for the platform: the copy is somebody's own site, not Plitzi's blank one.
    expect(source).toContain('export const space');
    expect(source).not.toContain('blankSpaceSpec');
  });

  /** The whole file has to survive, not just its header — the rewrite is of imports, not of the declaration. */
  it('keeps everything below the imports', () => {
    expect(blankSpaceSource()).toContain(blankSpaceSpec.pages[0].name);
    expect(blankSpaceSource().split('\n').length).toBeGreaterThan(100);
  });

  /**
   * The names the copy imports are names the package exports.
   *
   * The one assertion that catches the failure this whole path exists to prevent: the declaration is free to use
   * anything inside the package, and the copy can only use what is on the public entry. Moving a factory to a
   * module that is not re-exported writes a project that does not compile, and nothing else here would say so.
   */
  it('imports only names the package actually exports', () => {
    const match = /^import \{([^}]*)\} from '@plitzi\/sdk-authoring';$/m.exec(blankSpaceSource());
    if (!match) {
      throw new Error('the copy imports nothing from @plitzi/sdk-authoring');
    }

    for (const name of match[1].split(',').map(entry => entry.trim())) {
      expect(authoring, `@plitzi/sdk-authoring exports ${name}`).toHaveProperty(name);
    }
  });

  /** The receiver's name goes in here, so the scaffold never has to know which literals this file contains. */
  it('renames the copy, and slugs the url it derives ids from', () => {
    const source = blankSpaceSource({ name: 'My Site' });

    expect(source).toContain("name: 'My Site'");
    // A DNS label at the platform, and what every element id and selector is derived from.
    expect(source).toContain("permanentUrl: 'my-site'");
    expect(source).not.toContain(blankSpaceSpec.permanentUrl);
  });

  /**
   * The plugin slot is asked for, never assumed.
   *
   * The platform authors a new space from this same declaration and hosts nobody's plugins, so a `custom` element
   * in the default would render "Not Found" on every space anyone ever signed up for.
   */
  it('hosts a plugin only when asked, and never in the space the platform authors', () => {
    const plain = blankSpaceSource();
    const hosted = blankSpaceSource({
      plugin: { id: 'stat-card', renderType: 'statCard', attributes: { label: "Today's", series: [1, 2] } }
    });

    expect(plain).not.toContain('custom(');
    expect(hosted).toContain("renderType: 'statCard'");
    expect(hosted).toContain("id: 'stat-card'");
    // Attributes, which the component receives as props — written as source a person reads, quotes escaped.
    expect(hosted).toContain("label: 'Today\\'s'");
    expect(hosted).toContain('series: [1, 2]');
    // Prepended as its own line, then folded into the package import by the rewrite below.
    expect(hosted).toMatch(/^import \{[^}]*\bcustom\b[^}]*\} from '@plitzi\/sdk-authoring';$/m);
    expect(hosted).not.toMatch(/from '\.\./);
  });

  it('feeds the plugin from a data file when asked, through a provider and a binding', () => {
    const hosted = blankSpaceSource({
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

  /** Anything it cannot point at the package is a broken copy, so it is refused rather than written. */
  it('refuses a relative import it cannot rewrite', () => {
    expect(() => toPortableSource("import spec from '../blank/spec';\n\nconst x = 1;\n")).toThrow(/cannot rewrite/);
    expect(() => toPortableSource("const x = 1;\n\nexport { y } from '../y';\n")).toThrow(/still refers/);
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
