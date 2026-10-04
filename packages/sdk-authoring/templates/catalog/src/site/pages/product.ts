/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
/**
 * A page per product, at `/products/<slug>`: the same file, narrowed to the product the address names — and a message,
 * not an empty page, when no product has that name.
 */
import { apiContainer, container, heading, link, list, listItem, styles, text } from '@plitzi/sdk-authoring';

import { PRODUCTS_URL, productsSource } from '../data.ts';
import { t } from '../tokens.ts';

import type { PageSpec } from '@plitzi/sdk-authoring';

const detail = styles('product-detail', { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '640px' });

const back = styles('back-link', { color: t.muted, textDecoration: 'none' });

const products = productsSource('product-data');

export const product: PageSpec = {
  id: 'product',
  name: 'Product',
  slug: 'products/:slug',
  layout: { id: 'site', slot: 'site-main' },
  body: [
    link({ id: 'product-back', href: '/products', class: back, content: '← All products' }),
    apiContainer({
      id: products.id,
      query: PRODUCTS_URL,
      cache: true,
      children: [
        list({
          id: 'product-one',
          // A list is a `<ul>`: one product reads as a page, not as an indented item.
          css: { margin: '0px', padding: '0px', listStyleType: 'none' },
          from: products.data.products,
          as: '{{ source|filter(p => p.slug == navigation.routeParams.slug) }}',
          // Shown once the file answers with the product; the message below is the other side of the question.
          visible: {
            source: products.data.products,
            template: "{{ source|find('slug', navigation.routeParams.slug) }}"
          },
          row: r =>
            listItem({
              id: 'product-item',
              children: [
                container({
                  id: 'product-detail',
                  subType: 'article',
                  class: detail,
                  children: [
                    heading({ id: 'product-title', subType: 'h1', from: `${r.item}.title` }),
                    text({ id: 'product-summary', from: `${r.item}.summary` }),
                    text({
                      id: 'product-price',
                      from: `${r.item}.price`,
                      as: 'price',
                      css: { fontSize: '24px', fontWeight: 700 }
                    })
                  ]
                })
              ]
            })
        }),
        text('No product by that name.', {
          id: 'product-missing',
          visible: {
            source: products.data.products,
            template: "{{ source is defined and not (source|find('slug', navigation.routeParams.slug)) }}"
          }
        })
      ]
    })
  ]
};
