import { describe, expect, it } from 'vitest';

import { mayReceive, pageAccessOf, pageAccessRefusal, pageWithheldOf, withholdPages } from './pageAccess';

import type { Element, Schema } from '../types';

const element = (
  id: string,
  rootId: string,
  attributes: Record<string, unknown> = {},
  items: string[] = []
): Element => ({
  id,
  attributes,
  definition: { rootId, label: id, type: id === rootId ? 'page' : 'text', items, styleSelectors: { base: '' } }
});

const schema = (): Schema =>
  ({
    pages: ['home', 'staff'],
    flat: {
      home: element('home', 'home', { slug: '' }, ['welcome']),
      welcome: element('welcome', 'home', { content: 'Hello' }),
      staff: element('staff', 'staff', { slug: 'staff', access: { permissions: ['adminManage'] } }, ['secret']),
      secret: element('secret', 'staff', { content: 'The release checklist' })
    }
  }) as unknown as Schema;

describe('a page that says who may see it', () => {
  it('reads its permissions, and nothing from what is not a list of names', () => {
    expect(pageAccessOf({ access: { permissions: ['a', '', 3] } })).toEqual({ permissions: ['a'] });
    expect(pageAccessOf({ access: { permissions: [] } })).toBeUndefined();
    expect(pageAccessOf({ access: 'admin' })).toBeUndefined();
    expect(pageAccessOf({})).toBeUndefined();
  });

  it('refuses a visitor signed out, and one who lacks a permission', () => {
    const access = { permissions: ['adminManage'] };

    expect(pageAccessRefusal(access, undefined)).toBe('unauthenticated');
    expect(pageAccessRefusal(access, { permissions: ['spaceView'] })).toBe('forbidden');
    expect(pageAccessRefusal(access, { permissions: ['adminManage', 'spaceView'] })).toBeUndefined();
    expect(pageAccessRefusal(undefined, undefined)).toBeUndefined();
  });
});

describe('the space a visitor is sent', () => {
  it('holds none of a page they may not see — only the page, saying why', () => {
    const { schema: sent, withheld, kept } = withholdPages(schema(), { permissions: [] });

    expect(withheld).toEqual(['staff']);
    expect(kept).toEqual([]);
    expect(sent.flat.secret).toBeUndefined();
    expect(sent.flat.staff.definition.items).toEqual([]);
    expect(pageWithheldOf(sent.flat.staff.attributes)).toBe('forbidden');
    expect(JSON.stringify(sent)).not.toContain('The release checklist');
    // What the visitor may see is untouched.
    expect(sent.flat.welcome).toEqual(schema().flat.welcome);
  });

  it('says a signed-out visitor was refused for not being signed in', () => {
    expect(pageWithheldOf(withholdPages(schema(), undefined).schema.flat.staff.attributes)).toBe('unauthenticated');
  });

  it('is the space as it came for a visitor who may see everything, and says what it holds', () => {
    const original = schema();
    const { schema: sent, withheld, kept } = withholdPages(original, { permissions: ['adminManage'] });

    expect(sent).toBe(original);
    expect(withheld).toEqual([]);
    expect(kept).toEqual([{ permissions: ['adminManage'] }]);
    expect(mayReceive(kept, { permissions: ['adminManage'] })).toBe(true);
    expect(mayReceive(kept, { permissions: [] })).toBe(false);
    expect(mayReceive(kept, undefined)).toBe(false);
  });
});
