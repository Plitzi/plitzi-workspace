/**
 * A feature behind a flag: declared once in the space, both versions gated — exactly one is ever rendered, and the
 * flag is switched per environment without touching the space.
 */
import { container, text } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

export const recipe: SpaceSpec = {
  name: 'Flags',
  permanentUrl: 'flags',
  flags: { newCheckout: { description: 'The one-step checkout', value: false, rules: [] } },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        container({ id: 'checkout-new', flag: 'newCheckout', children: [text('One step')] }),
        container({ id: 'checkout-old', flag: '!newCheckout', children: [text('Three steps')] })
      ]
    }
  ]
};
