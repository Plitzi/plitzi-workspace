import { describe, expect, it } from 'vitest';

import { blankSpace, blankSpaceSource, blankSpaceSpec, toPortableSource } from './index';
import { validateSpace } from '../schema';

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
