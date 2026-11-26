import { describe, expect, it } from 'vitest';

import { authorSpace, button, carousel, list, listItem, onClick, setState, text } from '../../index';

import type { ElementSpec, SpaceSpec } from '../types';

const space = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Rows',
  permanentUrl: 'rows',
  pages: [{ id: 'home', name: 'Home', slug: '', body }]
});

describe('a row named in a template', () => {
  // A row had two names — `r.item` in a binding, `r.inTemplate.item` in a template — and the wrong one was found only
  // when authored (PZ-8): now `r.item` is the row's one name, completed wherever a template reads it.
  it('reads `r.item` in a visibility, a binding’s template and a flow’s step as the row in full', () => {
    const { schema, warnings } = authorSpace(
      space([
        list({
          id: 'rows',
          items: [{ name: 'a', extra: true }],
          row: r =>
            listItem({
              id: 'row',
              visible: {
                source: 'state.step',
                template: `{{ source is defined and (not ${r.item}.extra or source >= 2) }}`
              },
              children: [
                text({ id: 'label', from: `${r.item}.name` }),
                button({
                  id: 'pick',
                  content: 'Pick',
                  flows: [
                    [
                      onClick(),
                      setState({ key: 'picked', type: 'text', value: `{{ ${r.item}.name }} at {{ ${r.index} }}` })
                    ]
                  ]
                })
              ]
            })
        })
      ])
    );

    expect(JSON.stringify(schema.flat.row.definition.bindings)).toContain('(not list_rows.item.extra or source >= 2)');
    expect(JSON.stringify(schema.flat.pick.definition.interactions)).toContain(
      '{{ list_rows.item.name }} at {{ list_rows.index }}'
    );
    expect(warnings.map(warning => warning.code)).toEqual([]);
  });

  it('completes a carousel’s row by its own name, and leaves every other name as written', () => {
    const { schema } = authorSpace(
      space([
        carousel({
          id: 'hero',
          items: [{ title: 'a' }],
          row: r =>
            text({
              id: 'slide',
              from: `${r.item}.title`,
              visible: { source: 'state.rows', template: `{{ ${r.item}.title and source.item and state.rows.item }}` }
            })
        })
      ])
    );

    expect(JSON.stringify(schema.flat.slide.definition.bindings)).toContain(
      '{{ carousel_hero.item.title and source.item and state.rows.item }}'
    );
  });
});
