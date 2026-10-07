import { describe, expect, it } from 'vitest';

import { effectsOf } from './effects';
import { cloneSpace } from '../../helpers';
import { buildSpace } from '../../tests/helpers';

import type { Space } from '../../helpers';
import type { Element } from '@plitzi/sdk-shared';

const element = (id: string, parentId: string, type = 'text', attributes: Record<string, unknown> = {}): Element => ({
  id,
  attributes,
  definition: { rootId: 'home', parentId, label: type, type, items: [], styleSelectors: { base: '' } }
});

/** The space after `change`, beside the one before it. */
const changed = (change: (space: Space) => void): string[] => {
  const before = buildSpace();
  const after = cloneSpace(before);
  change(after);

  return effectsOf(before, after);
};

describe('what a write did, read off the space', () => {
  it('says nothing of a space that says the same thing with its keys in another order', () => {
    expect(
      changed(space => {
        const { subType } = space.schema.flat.c1.attributes;
        space.schema.flat.c1.attributes = { subType };
        const { name, permanentUrl } = space.schema.definition;
        space.schema.definition = { permanentUrl, name };
      })
    ).toEqual([]);
  });

  it('says each attribute added, changed and removed', () => {
    expect(
      changed(space => {
        space.schema.flat.c1.attributes = { tag: 'main' };
        space.schema.flat.home.attributes.name = 'Start';
      })
    ).toEqual(['home.name: "Home" → "Start"', 'c1.subType removed (was "section")', 'c1.tag = "main"']);
  });

  // The value written under a binding is not what the page shows: said, or the agent believes the page changed.
  it('says when the attribute that changed is one a binding computes', () => {
    expect(
      changed(space => {
        space.schema.flat.c1.attributes.subType = 'article';
        space.schema.flat.c1.definition.bindings = { attributes: [{ id: 'b', to: 'subType', source: 'state.tag' }] };
      })
    ).toContain('c1.subType: "section" → "article" — bound to state.tag: the page shows the binding\'s value');
  });

  it('says a subtree added or removed once, by its outermost element, with what it held', () => {
    expect(
      changed(space => {
        space.schema.flat.c1.definition.items = ['card'];
        space.schema.flat.card = {
          ...element('card', 'c1', 'container'),
          definition: { ...element('card', 'c1', 'container').definition, items: ['title'] }
        };
        space.schema.flat.title = element('title', 'card');
      })
    ).toEqual(['card (container) added in c1, with 1 inside']);
    expect(
      changed(space => {
        delete space.schema.flat.c1;
        space.schema.flat.home.definition.items = [];
      })
    ).toEqual(['c1 (container) removed from home']);
  });

  it('says an element moved, its classes, and a class of the style changed', () => {
    expect(
      changed(space => {
        space.schema.flat.c1.definition.styleSelectors = { base: 'card' };
        const box = space.style.platform.desktop.box;
        space.style.platform.desktop.box = { ...box, attributes: { base: { default: { display: 'grid' } } } };
      })
    ).toEqual([
      'c1 classes: +card −box',
      'style.platform.desktop.box.attributes.base.default.display: "flex" → "grid"',
      'style.platform.desktop.box.attributes.base.variants removed (was {"lg":{"default":{"font-size":"50px"}}})'
    ]);
  });

  it('says a page added as its element, and a list of names by what came and went', () => {
    expect(
      changed(space => {
        space.schema.flat.about = {
          id: 'about',
          attributes: { slug: 'about', name: 'About' },
          definition: { rootId: 'about', label: 'Page', type: 'page', items: [], styleSelectors: { base: '' } }
        };
        space.schema.pages = ['about', 'home'];
        space.schema.settings.transientState = ['menuOpen'];
      })
    ).toEqual(['about (page) added', 'space.settings.transientState = ["menuOpen"]']);
  });

  it('counts what it does not list, never drops it unsaid', () => {
    const effects = changed(space => {
      for (let index = 0; index < 50; index += 1) {
        space.schema.flat.c1.attributes[`a${String(index)}`] = index;
      }
    });

    expect(effects).toHaveLength(41);
    expect(effects.at(-1)).toBe('… and 10 more changes: read the resources listed in `changed`');
  });
});
