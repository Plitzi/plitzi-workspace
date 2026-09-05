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

  /** Named so a test, a binding or an agent can point at them; the rest are positional and free to move. */
  it('names the elements worth pointing at', () => {
    const { handles } = blankSpace();
    const named = Object.values(handles.page('').elements)
      .filter(handle => handle.named)
      .map(handle => handle.id)
      .sort();

    expect(named).toContain('hero-title');
    expect(named).toContain('cards');
    expect(named).toContain('docs-title');
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
              css: { desktop: { 'margin-top': '24px', 'z-index': '1' } }
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
    expect(source).toContain('from \'@plitzi/sdk-authoring\'');
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

    expect(source).toContain('name: \'My Site\'');
    // A DNS label at the platform, and what every element id and selector is derived from.
    expect(source).toContain('permanentUrl: \'my-site\'');
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
      plugin: { id: 'stat-card', renderType: 'statCard', settings: { label: 'Elements' } }
    });

    expect(plain).not.toContain('custom(');
    expect(hosted).toContain('renderType: \'statCard\'');
    expect(hosted).toContain('id: \'stat-card\'');
    // The settings attribute is a JSON string, so what the copy carries has to be a quoted, escaped one.
    expect(hosted).toContain('settings: \'{"label":"Elements"}\'');
    // Prepended as its own line, then folded into the package import by the rewrite below.
    expect(hosted).toMatch(/^import \{[^}]*\bcustom\b[^}]*\} from '@plitzi\/sdk-authoring';$/m);
    expect(hosted).not.toMatch(/from '\.\./);
  });

  /** Prettier wraps a long import across lines; a rewrite that only reads one-liners would drop the names. */
  it('rewrites an import however it is wrapped', () => {
    const rewritten = toPortableSource(
      ['import {', '  container,', '  heading', '} from \'../../elements\';', '', 'const x = 1;', ''].join('\n')
    );

    expect(rewritten).toBe(
      ['import { container, heading } from \'@plitzi/sdk-authoring\';', '', 'const x = 1;', ''].join('\n')
    );
  });

  /** Anything it cannot point at the package is a broken copy, so it is refused rather than written. */
  it('refuses a relative import it cannot rewrite', () => {
    expect(() => toPortableSource('import spec from \'../blank/spec\';\n\nconst x = 1;\n')).toThrow(/cannot rewrite/);
    expect(() => toPortableSource('const x = 1;\n\nexport { y } from \'../y\';\n')).toThrow(/still refers/);
  });

  it('merges every relative import into one, values and types apart', () => {
    const rewritten = toPortableSource(
      [
        'import { b, a } from \'../../elements\';',
        'import { c } from \'../../style\';',
        '',
        'import type { T } from \'../../schema\';',
        '',
        'const x = 1;',
        ''
      ].join('\n')
    );

    expect(rewritten).toBe(
      [
        'import { a, b, c } from \'@plitzi/sdk-authoring\';',
        '',
        'import type { T } from \'@plitzi/sdk-authoring\';',
        '',
        'const x = 1;',
        ''
      ].join('\n')
    );
  });
});
