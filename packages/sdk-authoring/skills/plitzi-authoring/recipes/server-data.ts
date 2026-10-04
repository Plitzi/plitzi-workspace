/**
 * Data in a server project (`create --mode server`): a JSON file the project serves (`public/data/plans.json`), read
 * by the page server before it answers — so the page arrives with the plans in its HTML, their anchors in place, and
 * nothing to fetch once the browser has it.
 *
 * - `runtime: 'server'` on the provider is the whole switch: authoring turns the space's server data (`rsc`) on for it.
 * - The answer is read exactly as in the browser — `plans.data.…` — so moving a provider between runtimes changes no
 *   binding.
 * - The page server resolves what a page and its layouts hold, never inside a component: the provider stays on the page
 *   and each row reaches the card component as a prop.
 * - `mockData` is what the builder shows while editing; the running page always reads the file.
 */
import { apiContainer, heading, list, listItem, styles, text } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const grid = styles('plan-grid', {
  display: 'grid',
  'grid-template-columns': 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '16px',
  margin: '0px',
  padding: '0px'
});

const card = styles('plan-card', { padding: '16px', 'border-radius': '12px', 'background-color': 'var(--card)' });

export const recipe: SpaceSpec = {
  name: 'Pricing',
  permanentUrl: 'pricing',
  variables: { color: { card: { light: '#ffffff', dark: '#16161d', default: '#ffffff' } } },
  components: [
    {
      id: 'plan-card',
      props: { item: { type: 'json', description: 'The plan: name and price' } },
      // The row of the list: an `<li>` reading the plan it was handed.
      root: listItem({
        id: 'plan-item',
        class: card,
        children: [heading({ subType: 'h3', from: 'props.item.name' }), text({ from: 'props.item.price' })]
      })
    }
  ],
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        apiContainer({
          id: 'plans',
          query: '/data/plans.json',
          runtime: 'server',
          mockData: { plans: [{ name: 'Starter', price: '$0' }] },
          children: [
            // `plans.data.plans` — the file's `plans` — in either runtime.
            list({ id: 'plan-list', class: grid, items: 'plans.data.plans', row: 'plan-card' }),
            text('No plans yet.', {
              visible: { source: 'plans.data.plans', template: '{{ source is defined and source|length == 0 }}' }
            })
          ]
        })
      ]
    }
  ]
};
