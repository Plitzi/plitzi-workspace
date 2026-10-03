/**
 * A link built from the row it is in — here "ask about this product" on WhatsApp, with the product's name in the
 * message. An attribute resolves a name with filters, so the text is encoded with `url_encode`.
 */
import { apiContainer, fontAwesome, link, list, text } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

export const recipe: SpaceSpec = {
  name: 'Contact',
  permanentUrl: 'contact',
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
                link({
                  target: 'blank',
                  href: 'https://wa.me/34600000000?text={{ list_products.item.title|url_encode }}',
                  children: [fontAwesome({ icon: 'fa-brands fa-whatsapp' }), text('Ask about it')]
                }),
                link({ href: 'mailto:shop@example.com', children: [text('Write to us')] })
              ]
            })
          ]
        })
      ]
    }
  ]
};
