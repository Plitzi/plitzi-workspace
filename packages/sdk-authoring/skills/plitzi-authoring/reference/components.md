# Components: a block written once, placed anywhere

A product card, a pricing tier, a testimonial: the same block on several pages, or several times on one, differing
only in what it says. A helper function that returns `ElementSpec` writes a COPY of the block wherever it is called —
the document holds every copy, and a person who later edits one in the builder edits that one. A **component** is the
block written ONCE: the document holds one tree, every placement is an instance of it, and an edit to it is an edit to
all of them, in code and in the builder alike.

```ts
import { component, container, heading, text } from '@plitzi/sdk-authoring';

import type { ComponentSpec } from '@plitzi/sdk-authoring';

export const productCard: ComponentSpec = {
  id: 'product-card',
  label: 'Product card',
  props: {
    title: { type: 'text', description: 'The product name', required: true },
    price: { type: 'number', description: 'In euros' },
    featured: { type: 'boolean', description: 'Wears the accent border', default: false }
  },
  slots: ['product-card-actions'],
  root: container({
    id: 'product-card-root',
    class: card,
    children: [
      heading({ id: 'product-card-title', bind: { content: 'props.title' } }),
      text({ id: 'product-card-price', content: '{{ props.price }} €' }),
      container({ id: 'product-card-actions' })
    ]
  })
};

// in the space
components: [productCard],
pages: [{ name: 'Shop', slug: 'shop', body: [
  component('product-card', { props: { title: 'Lamp', price: 40 }, children: { 'product-card-actions': [button('Buy')] } })
] }]
```

- **Props are attributes of the instance**, declared like a step's params (`type`, `description`, `required`,
  `default`, `options`) and read inside as `{{ props.<name> }}` — in a binding's `source`, a template or an attribute.
  A prop name is letters, digits and `_`, never one an instance already has (`referenceId`, `slot`, `className`…).
  A prop an instance leaves out, with no `default`, is `null`: `{{ props.blurb }}` prints nothing and
  `visible: 'props.featured'` keeps the element hidden.
- **A prop can be bound** like any attribute: `component('product-card', { bind: [{ to: 'title', source: 'list_products.item.name' }] })`.
  That is how a list row hands its record to a card — bind the record, not each field, if the card reads several:
  a `json` prop `item`, read as `{{ props.item.name }}`.
- **Slots** are elements of the component's tree that an instance fills. `children: [ … ]` fills a component with one
  slot; `children: { '<slot>': [ … ] }` names the slot for each. What fills a slot is the instance's, not the
  component's: it is authored on the page and sees the page's sources.
- **Closed.** Inside, nothing but `props` and the globals (`state`, `auth`, `navigation`, `theme`, `variables`,
  `computed`). A binding inside a component onto a provider of the page is refused — "nothing in this component answers
  to …" — because the component would render differently wherever it was placed. Put the provider inside the component,
  or hand the value in as a prop.
- **Ids are shared** with the whole space, like a layout's: name a component's elements after it (`product-card-title`).
  The same ids render once per instance, each with state of its own.
- **State of its own per instance.** A flow inside a component that names one of its elements —
  `toggleElement({ category: 'state', key: 'visibility' }, 'product-card-details')` — acts on THAT instance's copy.
  Global state is shared: `toggleInState({ key: 'favourites', value: '{{ props.product.id }}' })` from any card.
- **Components nest**: a component may place another. One that places itself, directly or through another, is refused.
- **Checked when written**: a component the space does not declare, a prop it does not declare, a required one left out,
  a value of the wrong kind (`featured: 'true'` for a boolean) and a child for a slot it does not have each throw, by name.

## Component, layout or helper?

| You have | Write |
| --- | --- |
| Chrome a page renders INSIDE — top bar, sidebar, footer | a **layout** ([layouts.md](layouts.md)) |
| One block placed many times, differing in its content | a **component** |
| Many blocks of DIFFERENT structure built by the same logic | a **helper** returning `ElementSpec` |
| A list of the same block over data | a **list** whose row is the block — or places the component ([lists.md](lists.md)) |

A component is also what a person editing the space in the builder will find in its Components panel, open and edit
once; a helper's output is, to them, a pile of copies.
