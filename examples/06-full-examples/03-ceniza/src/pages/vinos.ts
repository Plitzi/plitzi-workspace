import { container, heading, image, paragraph, text } from '@plitzi/sdk-authoring';

import { photo, photos, restaurant, sommelier, tastingMenu, wineSections, wineValues } from '../content.ts';
import {
  arrow,
  closeMenuOnLoad,
  eyebrow,
  label,
  linkTo,
  pageHero,
  pillarCard,
  section,
  sectionHead,
  shell,
  stat
} from '../layout.ts';

import type { Wine, WineSection } from '../content.ts';
import type { ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/**
 * On a phone the column headings are gone, so each price carries its own word — and a price a wine does not have
 * is left out there, where a dash under the word "Botella" says nothing a missing line would not.
 */
const priceCell = (value: string | undefined, caption: string): ElementSpec =>
  container({
    class: value ? 'winePriceCell' : 'winePriceCellEmpty',
    children: [text({ content: value ?? '—', class: 'winePrice' }), text({ content: caption, class: 'winePriceLabel' })]
  });

const wineItem = (wine: Wine): ElementSpec =>
  container({
    class: 'wineItem',
    children: [
      container({
        class: 'stack',
        children: [
          heading({ subType: 'h3', content: wine.name, class: 'wineName' }),
          text({ content: `${wine.producer} · ${wine.region}`, class: 'wineMeta' }),
          text({ content: wine.grape, class: 'wineGrape' })
        ]
      }),
      container({ class: 'winePrices', children: [priceCell(wine.glass, 'Copa'), priceCell(wine.bottle, 'Botella')] })
    ]
  });

const wineSection = (entry: WineSection): ElementSpec =>
  container({
    id: `vinos-${entry.id}`,
    subType: 'section',
    class: 'menuSection',
    children: [
      container({
        class: 'menuSectionHead',
        children: [
          heading({ subType: 'h2', content: entry.title, class: 'menuSectionTitle' }),
          paragraph({ content: entry.note, class: 'menuSectionNote' })
        ]
      }),
      container({
        class: 'menuItems',
        children: [
          container({
            class: 'wineHeadRow',
            children: [
              container({ class: 'grow' }),
              container({
                class: 'winePrices',
                children: [
                  text({ content: 'Copa', class: 'wineColumnLabel' }),
                  text({ content: 'Botella', class: 'wineColumnLabel' })
                ]
              })
            ]
          }),
          ...entry.items.map(wineItem)
        ]
      })
    ]
  });

export const vinos: PageSpec = {
  id: 'vinos',
  name: 'Vinos',
  slug: 'vinos',
  seoTitle: 'La bodega y la carta de vinos — Ceniza',
  seoDescription:
    'Vinos naturales de pequeños productores, doce referencias por copa cada semana y maridaje para el menú degustación.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('vinos', [
    pageHero({
      id: 'vinos-hero',
      titleId: 'vinos-title',
      photoId: photos.wineShelf,
      alt: 'Botellas de vino natural en la estantería de la bodega',
      kicker: 'Bodega · 180 referencias',
      title: 'Vinos con nombre y apellido',
      lead: 'Pequeños productores, viñedos vivos y una carta de copas que cambia cada semana.',
      actions: [linkTo('/degustacion', 'buttonPrimary', [label('Ver el maridaje')])]
    }),
    section([
      sectionHead('Cómo elegimos', 'Tres reglas para entrar en la bodega', undefined, 'vinos-values-title'),
      container({ class: 'pillars', children: wineValues.map(pillarCard) })
    ]),
    section(
      [
        container({
          class: 'split',
          children: [
            container({
              class: 'splitMedia',
              children: [
                image({
                  src: photo(photos.winePour, 1200),
                  alt: 'Vino tinto sirviéndose en una copa junto a la mesa',
                  class: 'photoTall',
                  loadMode: 'lazy'
                })
              ]
            }),
            container({
              class: 'splitText',
              children: [
                eyebrow('La sumiller'),
                paragraph({ id: 'vinos-sommelier-quote', content: sommelier.quote, class: 'quoteLarge' }),
                container({
                  class: 'stack',
                  children: [
                    text({ content: sommelier.name, class: 'quoteName' }),
                    text({ content: sommelier.role, class: 'quoteRole' })
                  ]
                }),
                container({
                  class: 'statRow',
                  children: [
                    stat('180', 'referencias en la bodega'),
                    stat('12', 'vinos por copa cada semana'),
                    stat('9 de 10', 'de bodegas pequeñas')
                  ]
                })
              ]
            })
          ]
        })
      ],
      'sectionTight'
    ),
    section(
      [
        sectionHead(
          'La carta de vinos',
          `Selección de ${restaurant.season.toLowerCase()}`,
          'Precios por copa y por botella. Pregunta por las botellas fuera de carta: siempre hay alguna esperando.',
          'vinos-list-title'
        ),
        ...wineSections.map(wineSection)
      ],
      'sectionTight'
    ),
    container({
      subType: 'section',
      class: 'inkBand',
      children: [
        container({
          class: 'inkGrid',
          children: [
            container({
              class: 'splitText',
              children: [
                eyebrow('Maridaje', 'inkEyebrow'),
                heading({ subType: 'h2', content: 'Seis copas para nueve pasos.', class: 'inkTitle' }),
                paragraph({
                  content: `Irene elige cada copa pensando en el paso al que acompaña: ${tastingMenu.pairing} con vino o ${tastingMenu.pairingFree} en la versión sin alcohol, con fermentados de la casa.`,
                  class: 'inkLead'
                }),
                container({
                  class: 'heroActions',
                  children: [
                    linkTo('/degustacion', 'buttonOnInk', [label('Ver el menú degustación')]),
                    linkTo('/reservas', 'buttonOnPhoto', [label('Reservar'), arrow()])
                  ]
                })
              ]
            }),
            image({
              src: photo(photos.vineyard, 1100),
              alt: 'Copa de vino sobre una baranda frente a un viñedo',
              class: 'inkPhoto',
              loadMode: 'lazy'
            })
          ]
        })
      ]
    })
  ])
};
