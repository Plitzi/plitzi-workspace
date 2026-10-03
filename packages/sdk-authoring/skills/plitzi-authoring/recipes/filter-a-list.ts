/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
/**
 * Filter and sort a list: a select writes the chosen category to `state`, and the list is bound through a template
 * that hands over its VALUE — only the matching rows are rendered, with a count and an empty state over the same rows.
 */
import { apiContainer, formControl, list, named, on, setState, text } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

// One predicate, read three times: the rows, their count, and whether there are none.
const shown =
  "source|filter(p => (state.category ?? 'all') == 'all' or p.category == state.category)|sort((a, b) => a.price - b.price)";

export const recipe: SpaceSpec = {
  name: 'Filtered',
  permanentUrl: 'filtered',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        // A control outside a form keeps its own value and fires `onChange` with `{ value, name }`: no form needed.
        formControl({
          name: 'category',
          label: 'Category',
          subType: 'select',
          options: [
            { label: 'Everything', value: 'all' },
            { label: 'Processors', value: 'cpu' },
            { label: 'Graphics cards', value: 'gpu' }
          ],
          defaultValue: 'all',
          // A filter always has an answer: the select is not a question that must be filled in.
          required: false,
          flows: [
            [named('picked', on('onChange')), setState({ key: 'category', type: 'text', value: '{{ picked.value }}' })]
          ]
        }),
        apiContainer({
          id: 'catalog',
          query: '/data/products.json',
          cache: true,
          children: [
            text({ from: 'catalog.data.products', as: `{{ ${shown}|length }} shown` }),
            list({
              id: 'shown',
              from: 'catalog.data.products',
              as: `{{ ${shown} }}`,
              children: [text({ from: 'shown.item.title' })]
            }),
            text('Nothing in that category.', {
              visible: {
                source: 'catalog.data.products',
                template: `{{ source is defined and ${shown}|length == 0 }}`
              }
            })
          ]
        })
      ]
    }
  ]
};
