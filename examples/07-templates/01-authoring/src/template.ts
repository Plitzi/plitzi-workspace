import { authorTemplate, button, container, heading, list, listItem, styles, text } from '@plitzi/sdk-authoring';

import type { AuthoredTemplate } from '@plitzi/sdk-authoring';

/**
 * A pricing card, declared as what a template actually is: one subtree and the rules that dress it.
 *
 * Nothing about it belongs to a space. It is written here, hosted as a JSON somewhere, and instantiated on a
 * canvas that this file will never see — which is the whole reason its style is declared beside it rather than
 * assumed: a class that stays behind is an element that renders unstyled in somebody else's space, and it is
 * invisible from this side.
 */

const card = styles('pricing-card', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '16px',
  padding: '32px 24px',
  'border-radius': '12px',
  border: '1px solid #e4e4e7',
  'background-color': '#ffffff',
  'max-width': '320px'
});

const price = styles('pricing-card__price', {
  'font-size': '40px',
  'font-weight': '700',
  'line-height': '1'
});

const features = styles('pricing-card__features', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  color: '#52525b'
});

const cta = styles('pricing-card__cta', {
  padding: '12px 20px',
  'border-radius': '8px',
  border: 'none',
  'background-color': '#18181b',
  color: '#ffffff',
  cursor: 'pointer'
});

export const pricingCard = (): AuthoredTemplate =>
  authorTemplate({
    name: 'Pricing card',
    description: 'A price, three features and a call to action.',
    root: container({
      class: card,
      children: [
        text('Starter'),
        heading('$19', { subType: 'h3', class: price }),
        list({
          class: features,
          children: [
            listItem({ children: [text('Up to 3 spaces')] }),
            listItem({ children: [text('Custom domain')] }),
            listItem({ children: [text('Email support')] })
          ]
        }),
        button({ content: 'Start free trial', class: cta })
      ]
    })
  });
