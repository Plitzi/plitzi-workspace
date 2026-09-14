import { container, heading, paragraph, text } from '@plitzi/sdk-authoring';

import { faqs, giftCards, giftSteps, photos, restaurant } from '../content';
import {
  closeMenuOnLoad,
  externalLink,
  eyebrow,
  faqList,
  label,
  noteItem,
  pageHero,
  processGrid,
  section,
  sectionHead,
  shell
} from '../layout';

import type { GiftCard } from '../content';
import type { ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/** There is no shop behind this demo: a card is asked for by email, with the subject already written. */
const orderHref = (card: GiftCard): string =>
  `mailto:${restaurant.email}?subject=${encodeURIComponent(`Tarjeta regalo: ${card.name}`)}`;

const giftCard = (card: GiftCard): ElementSpec =>
  container({
    subType: 'article',
    class: card.featured ? 'priceCardFeatured' : 'priceCard',
    children: [
      eyebrow(card.kicker),
      heading({ subType: 'h3', content: card.name, class: 'priceCardName' }),
      text({ content: card.price, class: 'priceCardValue' }),
      paragraph({ content: card.note, class: 'priceCardNote' }),
      container({ class: 'noteList', children: card.features.map(noteItem) }),
      container({ class: 'grow' }),
      externalLink(orderHref(card), card.featured ? 'buttonPrimary' : 'buttonGhost', [label('Regalar esta tarjeta')])
    ]
  });

export const regalar: PageSpec = {
  id: 'regalar',
  name: 'Tarjetas regalo',
  slug: 'regalar',
  seoTitle: 'Tarjetas regalo — Ceniza',
  seoDescription: 'Regala Ceniza: tarjetas de importe libre o el menú Brasa para dos, válidas durante doce meses.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('regalar', [
    pageHero({
      id: 'regalar-hero',
      titleId: 'regalar-title',
      photoId: photos.gift,
      alt: 'Manos sosteniendo un regalo envuelto en papel kraft',
      kicker: 'Tarjetas regalo',
      title: 'Regala una noche junto al fuego',
      lead: 'Un importe libre o una experiencia completa. Llega al email en minutos y se puede disfrutar durante un año.'
    }),
    section([
      sectionHead(
        'Elige',
        'Tres formas de regalar Ceniza',
        'Todas incluyen un mensaje personal y se pueden canjear en sala, en la mesa larga o en las cenas de la agenda.',
        'regalar-cards-title'
      ),
      container({ id: 'regalar-cards', class: 'priceGrid', children: giftCards.map(giftCard) })
    ]),
    section(
      [
        sectionHead('Cómo funciona', 'Regalar lleva dos minutos', undefined, 'regalar-steps-title'),
        processGrid(giftSteps, 'regalar-steps')
      ],
      'sectionTight'
    ),
    section(
      [
        sectionHead('Preguntas', 'Todo sobre las tarjetas regalo', undefined, 'regalar-faq-title'),
        faqList('faqRegalar', faqs.regalar)
      ],
      'sectionTight'
    )
  ])
};
