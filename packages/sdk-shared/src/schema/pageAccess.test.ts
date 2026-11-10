import { describe, expect, it } from 'vitest';

import {
  mayReceive,
  notFoundWhenRefused,
  pageAccessOf,
  pageAccessRefusal,
  pageWithheldOf,
  withheldPageOf,
  withholdPages
} from './pageAccess';
import { collectServerElements } from './serverElements';

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

  // Made once per group of visitors and handed out again: what is kept by the schema object is kept for all of them.
  it('hands every visitor withheld the same pages the same space, and another group another one', () => {
    const original = schema();
    const signedOut = withholdPages(original, undefined).schema;

    expect(withholdPages(original, undefined).schema).toBe(signedOut);
    expect(withholdPages(original, { permissions: [] }).schema).not.toBe(signedOut);
    expect(withholdPages(original, { permissions: [] }).schema).toBe(
      withholdPages(original, { permissions: ['x'] }).schema
    );
    // Another space object is another space, whatever it holds.
    expect(withholdPages(schema(), undefined).schema).not.toBe(signedOut);
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

// A back-office says nothing to whoever probes its paths: a refusal is an answer that something is there.
describe('a page that answers as if it did not exist to whoever it is not for', () => {
  const hiding = (): Schema => {
    const space = schema();
    space.flat.staff = element(
      'staff',
      'staff',
      { slug: 'staff', access: { permissions: ['adminManage'] }, unauthorizedBehaviour: 'notFound' },
      ['secret']
    );

    return space;
  };

  it('says so only when its unauthorized behaviour is notFound', () => {
    expect(notFoundWhenRefused({ unauthorizedBehaviour: 'notFound' })).toBe(true);
    expect(notFoundWhenRefused({ unauthorizedBehaviour: 'redirect' })).toBe(false);
    expect(notFoundWhenRefused({})).toBe(false);
  });

  it('is not in the space a visitor it is not for is sent — not its name, nor its path — signed out or in', () => {
    for (const caller of [undefined, { permissions: ['spaceView'] }]) {
      const { schema: sent, withheld } = withholdPages(hiding(), caller);

      expect(withheld).toEqual(['staff']);
      expect(sent.pages).toEqual(['home']);
      expect(sent.flat.staff).toBeUndefined();
      expect(sent.flat.secret).toBeUndefined();
      expect(JSON.stringify(sent)).not.toContain('staff');
      expect(sent.flat.welcome).toEqual(schema().flat.welcome);
    }
  });

  it('is sent whole to a visitor it is for', () => {
    const original = hiding();

    expect(withholdPages(original, { permissions: ['adminManage'] }).schema).toBe(original);
  });

  it('keeps a page for signed-in visitors from the signed out, and sends it whole to any session', () => {
    const space = schema();
    space.flat.staff = element(
      'staff',
      'staff',
      { slug: 'staff', accessLevel: 'authenticated', unauthorizedBehaviour: 'notFound' },
      ['secret']
    );

    const signedOut = withholdPages(space, undefined);
    expect(signedOut.schema.pages).toEqual(['home']);
    expect(JSON.stringify(signedOut.schema)).not.toContain('The release checklist');
    const signedIn = withholdPages(space, { permissions: [] });
    expect(signedIn.schema).toBe(space);
    expect(mayReceive(signedIn.kept, undefined)).toBe(false);
  });

  // A console page redirects a signed-out visitor to sign in — and its whole content was still in the space they were
  // sent: a visitor of a public page downloaded every page of the dashboard (D2).
  it('keeps a page that sends the signed out to sign in from them, the page and its redirect kept', () => {
    const space = schema();
    space.flat.staff = element(
      'staff',
      'staff',
      {
        slug: 'staff',
        accessLevel: 'authenticated',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: 'home'
      },
      ['secret']
    );

    const signedOut = withholdPages(space, undefined);
    expect(signedOut.withheld).toEqual(['staff']);
    expect(signedOut.schema.pages).toContain('staff');
    expect(signedOut.schema.flat.staff.attributes).toMatchObject({
      withheld: 'unauthenticated',
      unauthorizedBehaviour: 'redirect'
    });
    expect(JSON.stringify(signedOut.schema)).not.toContain('The release checklist');
    expect(withholdPages(space, { permissions: [] }).schema).toBe(space);
  });
});

describe('the page a space draws in place of one withheld', () => {
  const withSubstitute = (withheldPage: string): Schema => {
    const space = schema();

    return {
      ...space,
      pages: [...space.pages, 'noAccess'],
      settings: { withheldPage },
      flat: {
        ...space.flat,
        noAccess: element('noAccess', 'noAccess', { slug: 'no-access' }, ['whoApi']),
        whoApi: {
          ...element('whoApi', 'noAccess'),
          definition: { ...element('whoApi', 'noAccess').definition, runtime: 'server' }
        }
      }
    } as unknown as Schema;
  };

  it('is a page of the space that every visitor may see — or none', () => {
    expect(withheldPageOf(withSubstitute('noAccess'))).toBe('noAccess');
    expect(withheldPageOf(withSubstitute('staff'))).toBeUndefined();
    expect(withheldPageOf(withSubstitute('welcome'))).toBeUndefined();
    expect(withheldPageOf({ flat: withSubstitute('noAccess').flat })).toBeUndefined();
  });

  it("is walked for the server's providers as the withheld page's body", () => {
    const sent = withholdPages(withSubstitute('noAccess'), undefined).schema;

    expect(collectServerElements(sent, 'staff').map(each => each.id)).toEqual(['whoApi']);
    expect(collectServerElements(withSubstitute('noAccess'), 'staff')).toEqual([]);
  });
});
