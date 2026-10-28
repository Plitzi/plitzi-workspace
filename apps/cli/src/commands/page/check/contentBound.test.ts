import { describe, expect, it } from 'vitest';

import { contentBound } from './space';

import type { Element as SchemaElement } from '@plitzi/sdk-shared';

// A run's ban key, "Ban <name>", was told to keep its label on one line — the very wrapping its task asked for.
describe('a label its data writes', () => {
  it('is one whose content is bound — as long as the data, left to wrap', () => {
    const element = (bindings: Record<string, { to: string }[]>): SchemaElement =>
      // The two fields this rule reads of an element; the rest of a schema element is none of this test's.
      ({ id: 'x', definition: { bindings } }) as unknown as SchemaElement;
    const schema = {
      flat: {
        'moderation-ban': element({ 'source-1': [{ to: 'content' }] }),
        'site-sign-in': element({}),
        'room-card': element({ 'source-1': [{ to: 'visibility' }] })
      }
    };

    expect(contentBound(schema, 'moderation-ban')).toBe(true);
    expect(contentBound(schema, 'site-sign-in')).toBe(false);
    expect(contentBound(schema, 'room-card')).toBe(false);
    expect(contentBound(undefined, 'moderation-ban')).toBe(false);
  });
});
