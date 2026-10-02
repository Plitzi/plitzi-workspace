import { authorSpace, container, heading, paragraph, text } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * A space whose parts are switched by feature flags — one per layer that may decide one:
 *
 * - `newCheckout`: off by default, the two sides of a rollout gated on it (`checkout-new` / `checkout-old`), and a text
 *   that reads it through the `flags` source;
 * - `promo`: off unless the URL asks for it (`?promo=yes`) — a rule;
 * - `serverOnly`: off in the space, turned on by the server serving it — the `server` layer;
 * - `labs`: a whole page that is not found while it is off.
 */
export const FLAG_IDS = {
  home: 'flags-home',
  labs: 'flags-labs',
  checkoutNew: 'checkout-new',
  checkoutOld: 'checkout-old',
  promo: 'promo',
  byServer: 'by-server',
  reading: 'reading-flag'
};

export const FLAG_TEXT = {
  checkoutNew: 'New one-step checkout',
  checkoutOld: 'Classic checkout',
  promo: 'Spring promo',
  byServer: 'Switched on by the server',
  labs: 'Labs'
};

const flags: NonNullable<Schema['flags']> = {
  newCheckout: { description: 'The one-step checkout', value: false, rules: [] },
  promo: {
    value: false,
    rules: [
      { when: { combinator: 'and', rules: [{ field: 'queryParams.promo', operator: '=', value: 'yes' }] }, value: true }
    ]
  },
  serverOnly: { value: false, rules: [] },
  labs: { value: false, rules: [] }
};

export const flagsSpace = (): AuthoredSpace =>
  authorSpace({
    name: 'Flags',
    permanentUrl: 'flags',
    flags,
    pages: [
      {
        id: FLAG_IDS.home,
        name: 'Home',
        slug: '',
        body: [
          heading('Feature flags', { subType: 'h1' }),
          container({
            id: FLAG_IDS.checkoutNew,
            flag: 'newCheckout',
            children: [paragraph(FLAG_TEXT.checkoutNew)]
          }),
          container({
            id: FLAG_IDS.checkoutOld,
            flag: '!newCheckout',
            children: [paragraph(FLAG_TEXT.checkoutOld)]
          }),
          container({ id: FLAG_IDS.promo, flag: 'promo', children: [paragraph(FLAG_TEXT.promo)] }),
          container({ id: FLAG_IDS.byServer, flag: 'serverOnly', children: [paragraph(FLAG_TEXT.byServer)] }),
          text('', { id: FLAG_IDS.reading, bind: { content: 'flags.newCheckout' } })
        ]
      },
      {
        id: FLAG_IDS.labs,
        name: 'Labs',
        slug: 'labs',
        flag: 'labs',
        body: [heading(FLAG_TEXT.labs, { subType: 'h1' })]
      }
    ]
  });
