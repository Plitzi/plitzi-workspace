/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
/**
 * A page per record: a card links to `/products/<slug>`, and the detail page narrows the same file to the product its
 * address names — with a message, not an empty page, when no product has that name.
 */
import { apiContainer, heading, link, list, text, listItem } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

export const recipe: SpaceSpec = {
  name: 'Detail',
  permanentUrl: 'detail',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        apiContainer({
          id: 'catalog',
          query: '/data/products.json',
          cache: true,
          children: [
            list({
              id: 'products',
              items: 'catalog.data.products',
              children: [
                listItem({
                  children: [
                    // An attribute reads a name with filters, spelled in full.
                    link({
                      href: '/products/{{ list_products.item.slug|url_encode }}',
                      children: [text({ from: 'products.item.title' })]
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    },
    {
      id: 'product',
      name: 'Product',
      slug: 'products/:slug',
      body: [
        apiContainer({
          id: 'catalog-one',
          query: '/data/products.json',
          cache: true,
          children: [
            list({
              id: 'this-product',
              from: 'catalog-one.data.products',
              as: '{{ source|filter(p => p.slug == navigation.routeParams.slug) }}',
              visible: {
                source: 'catalog-one.data.products',
                template: "{{ source|find('slug', navigation.routeParams.slug) }}"
              },
              children: [listItem({ children: [heading({ subType: 'h1', from: 'this-product.item.title' })] })]
            }),
            text('No product by that name.', {
              visible: {
                source: 'catalog-one.data.products',
                template: "{{ source is defined and not (source|find('slug', navigation.routeParams.slug)) }}"
              }
            })
          ]
        })
      ]
    }
  ]
};
