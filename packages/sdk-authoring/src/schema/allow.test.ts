import { describe, expect, it } from 'vitest';

import { apiContainer } from '../elements';
import { authorSpace } from '../index';
import { singlePageSpace } from '../testing';

import type { AllowedBreak } from './types';

/**
 * A fixture that breaks a check on purpose is how a suite tests what the runtime does with a document no author would
 * write. The escape is narrow and loud: one code on one element, back as a warning with its reason, and refused the
 * moment it stops matching anything.
 */

const unresolved = singlePageSpace([
  apiContainer({ id: 'unresolved', query: '/order/{{orderId}}', method: 'get', subType: 'section' }),
  apiContainer({ id: 'resolved', query: '/orders', method: 'get', subType: 'section' })
]);

const onPurpose: AllowedBreak = {
  code: 'template-unknown-name',
  element: 'unresolved',
  why: 'a URL whose token nothing answers must never be asked'
};

describe('authorSpace / allow', () => {
  it('refuses the break when nothing allows it', () => {
    expect(() => authorSpace(unresolved)).toThrow(/\[template-unknown-name\].*\(unresolved\)/);
  });

  it('lets the named break through, and says so in the warnings with the reason', () => {
    const { schema, warnings } = authorSpace(unresolved, { allow: [onPurpose] });

    expect(schema.flat.unresolved.attributes).toMatchObject({ query: '/order/{{orderId}}' });
    const warning = warnings.find(entry => entry.code === 'template-unknown-name');

    expect(warning?.elementId).toBe('unresolved');
    expect(warning?.message).toMatch(/^Allowed \(a URL whose token nothing answers must never be asked\): /);
  });

  /** A code alone would let a second, accidental instance through beside the intended one. */
  it('allows it on that element only', () => {
    const both = singlePageSpace([
      apiContainer({ id: 'unresolved', query: '/order/{{orderId}}', method: 'get', subType: 'section' }),
      apiContainer({ id: 'typo', query: '/order/{{ordrId}}', method: 'get', subType: 'section' })
    ]);

    expect(() => authorSpace(both, { allow: [onPurpose] })).toThrow(/\(typo\)/);
  });

  it('refuses an allowance that matches nothing, so it cannot outlive its break', () => {
    expect(() => authorSpace(unresolved, { allow: [onPurpose, { ...onPurpose, element: 'resolved' }] })).toThrow(
      /\[allow\] "template-unknown-name" on "resolved" is allowed, but nothing raised it/
    );
  });
});
