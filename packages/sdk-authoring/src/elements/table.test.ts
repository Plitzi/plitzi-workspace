import { describe, expect, it } from 'vitest';

import { apiContainer, authorSpace, table, tableColumn, text } from '../index';

import type { ElementSpec, SpaceSpec } from '../schema';

const page = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Tables',
  permanentUrl: 'tables',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [apiContainer({ id: 'site', query: '/data/home.json', children: body })]
    }
  ]
});

describe('a table', () => {
  // A data table had no element: a markdown table could not change with the state, and rows of a grid are not read as a
  // table by a screen reader or a search engine (PZ-6).
  it('writes its columns from its row, its items bound like a list’s, each cell reading the row', () => {
    const { schema, warnings } = authorSpace(
      page([
        table({
          id: 'plans',
          caption: 'Plans compared',
          items: 'site.data.plans',
          row: r => [
            tableColumn({
              id: 'plan',
              header: 'Plan',
              rowHeader: true,
              children: [text({ id: 'plan-name', from: `${r.item}.name` })]
            }),
            tableColumn({
              id: 'price',
              header: 'Price',
              children: [text({ id: 'plan-price', from: `${r.item}.price` })]
            })
          ]
        })
      ])
    );
    const plans = schema.flat.plans;

    expect(plans.definition.type).toBe('table');
    expect(plans.attributes.caption).toBe('Plans compared');
    expect(plans.definition.items).toEqual(['plan', 'price']);
    expect(plans.definition.bindings).toMatchObject({
      attributes: [{ to: 'items', source: 'apiContainer_site.data.plans' }]
    });
    // Each cell reads the row the table publishes, as a list's row does (`table_plans`).
    expect(schema.flat['plan-name'].definition.bindings).toMatchObject({
      attributes: [{ to: 'content', source: 'table_plans.item.name' }]
    });
    expect(warnings.map(warning => warning.code)).toEqual([]);
  });

  it('takes no children beside a row: its row IS its columns', () => {
    expect(() =>
      table({
        id: 'plans',
        items: [],
        row: () => [tableColumn({ header: 'Plan' })],
        children: [tableColumn({ header: 'x' })]
      })
    ).toThrow(/takes no `children`/);
  });
});
