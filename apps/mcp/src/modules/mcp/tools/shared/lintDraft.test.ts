import { describe, expect, it } from 'vitest';

import { lintDraft } from './lintDraft';
import { cloneSpace } from '../../helpers';
import { buildSpace } from '../../tests/helpers';

import type { Space } from '../../helpers';
import type { Operation } from '../operations';

/** The fixture with a text beside the container, so an edit can touch one element and leave the other alone. */
const space = (): Space => {
  const base = buildSpace();
  base.schema.flat.label = {
    id: 'label',
    attributes: { content: 'Hello' },
    definition: {
      rootId: 'home',
      parentId: 'home',
      label: 'Text',
      type: 'text',
      items: [],
      styleSelectors: { base: '' }
    }
  };
  base.schema.flat.home.definition.items = [...(base.schema.flat.home.definition.items ?? []), 'label'];

  return base;
};

const patch = (ref: string): Operation => ({ type: 'patchElement', pageRef: 'home', ref, props: {} });

/** `before` changed by `change`, as a batch would leave it. */
const drafted = (before: Space, change: (draft: Space) => void): Space => {
  const draft = cloneSpace(before);
  change(draft);

  return draft;
};

describe('lintDraft', () => {
  it('passes a batch that leaves what it touched whole', () => {
    const before = space();
    const draft = drafted(before, next => {
      next.schema.flat.label.attributes.content = 'Changed';
    });

    expect(lintDraft(draft, [patch('label')], before)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('blocks what the batch got wrong in an element it touched', () => {
    const before = space();
    const draft = drafted(before, next => {
      next.schema.flat.label.attributes.title = 'Not read';
    });

    const result = lintDraft(draft, [patch('label')], before);

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.path)).toEqual(['element "label"']);
    expect(result.errors[0].message).toContain('"title"');
  });

  // The agent never takes it for its own change, and cannot save over it without fixing it.
  it('blocks what was already wrong in an element it touched, and says it was already there', () => {
    const broken = drafted(space(), next => {
      next.schema.flat.label.attributes.title = 'Not read';
    });
    const draft = drafted(broken, next => {
      next.schema.flat.label.attributes.content = 'Changed';
    });

    const [error] = lintDraft(draft, [patch('label')], broken).errors;

    expect(error.message).toMatch(/^Pre-existing malformation in element "label"/);
    expect(error.hint).toContain('NOT caused by your change');
  });

  it('does not hold an element it never touched against it', () => {
    const broken = drafted(space(), next => {
      next.schema.flat.label.attributes.title = 'Not read';
    });
    const draft = drafted(broken, next => {
      next.schema.flat.c1.attributes.subType = 'article';
    });

    expect(lintDraft(draft, [patch('c1')], broken).valid).toBe(true);
  });

  // A delete can orphan an element the batch never named: a broken tree is refused wherever it landed.
  it('blocks a structural error the batch introduced, even outside what it touched', () => {
    const before = space();
    const draft = drafted(before, next => {
      next.schema.flat.home.definition.items = ['c1'];
    });

    const result = lintDraft(draft, [patch('c1')], before);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.message.includes('label'))).toBe(true);
  });

  it('reads a plugin installed on the space as a type, not a typo', () => {
    const before: Space = {
      ...space(),
      catalog: { weatherCard: { custom: true, attributes: ['city'], styleSelectors: ['base'] } }
    };
    const draft = drafted(before, next => {
      next.schema.flat.label.definition.type = 'weatherCard';
      next.schema.flat.label.attributes = { city: 'Lima' };
    });

    expect(lintDraft(draft, [patch('label')], before)).toEqual({ valid: true, errors: [], warnings: [] });
  });
});
