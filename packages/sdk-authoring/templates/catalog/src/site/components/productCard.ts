/**
 * A product as a card, placed once per product: one component, so a change to the card is a change to every card. It
 * reads the product through its `item` prop and links to the product's own page.
 */
import { heading, link, styles, text } from '@plitzi/sdk-authoring';

import { t } from '../tokens.ts';

import type { ComponentSpec } from '@plitzi/sdk-authoring';

const card = styles('product-card', {
  css: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    height: '100%',
    padding: '20px',
    borderRadius: '14px',
    border: `1px solid ${t.border}`,
    backgroundColor: t.surface,
    color: t.foreground,
    textDecoration: 'none',
    transition: 'border-color 150ms ease'
  },
  states: { hover: { borderColor: t.primary } }
});

const badge = styles('product-badge', {
  alignSelf: 'flex-start',
  padding: '2px 10px',
  borderRadius: '999px',
  backgroundColor: t.primary,
  color: t['on-primary'],
  fontSize: '12px',
  fontWeight: 600
});

const summary = styles('product-summary', { margin: '0px', color: t.muted, fontSize: '14px', flexGrow: 1 });

const price = styles('product-price', { fontWeight: 700 });

export const productCard: ComponentSpec = {
  id: 'product-card',
  props: { item: { type: 'json', description: 'The product: slug, title, summary, price and, maybe, a badge' } },
  root: link({
    id: 'card',
    href: '/products/{{ props.item.slug|url_encode }}',
    class: card,
    children: [
      text({ id: 'card-badge', class: badge, from: 'props.item.badge', visible: 'props.item.badge' }),
      heading({ id: 'card-title', subType: 'h3', from: 'props.item.title', css: { margin: '0px', fontSize: '18px' } }),
      text({ id: 'card-summary', class: summary, from: 'props.item.summary' }),
      text({ id: 'card-price', class: price, from: 'props.item.price', as: 'price' })
    ]
  })
};
