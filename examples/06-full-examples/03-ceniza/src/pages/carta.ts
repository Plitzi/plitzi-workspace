import {
  button,
  container,
  heading,
  image,
  onClick,
  paragraph,
  setState,
  text,
  toggleState
} from '@plitzi/sdk-authoring';

import { menu, photo, photos, restaurant } from '../content';
import { arrow, closeMenuOnLoad, eyebrow, label, linkTo, pageHero, section, shell } from '../layout';
import { tags } from './inicio';

import type { Dish, MenuSection } from '../content';
import type { ElementSpec, PageSpec, StepSpec } from '@plitzi/sdk-authoring';

const VEGETARIAN = 'cartaVegetariano';
const GLUTEN_FREE = 'cartaSinGluten';

const isVegetarian = (dish: Dish): boolean => Boolean(dish.tags?.some(tag => tag === 'V' || tag === 'VG'));

const isGlutenFree = (dish: Dish): boolean => Boolean(dish.tags?.includes('SG'));

const menuItem = (dish: Dish): ElementSpec =>
  container({
    class: 'menuItem',
    children: [
      container({
        class: 'menuItemTop',
        children: [
          heading({ subType: 'h3', content: dish.name, class: 'menuItemName' }),
          container({ class: 'menuLeader' }),
          text({ content: dish.price, class: 'price' })
        ]
      }),
      paragraph({ content: dish.description, class: 'menuItemDescription' }),
      ...tags(dish)
    ]
  });

/**
 * A dish a filter can take off the carta.
 *
 * `visible` reads one source, so a dish that fails both filters sits behind two boxes, each answering to one. The
 * decision is made here, where the tags are, and the page only ever reads two booleans.
 */
const filterable = (dish: Dish): ElementSpec => {
  const gates = [
    ...(isVegetarian(dish) ? [] : [`!state.${VEGETARIAN}`]),
    ...(isGlutenFree(dish) ? [] : [`!state.${GLUTEN_FREE}`])
  ];

  return gates.reduce<ElementSpec>((child, visible) => container({ visible, children: [child] }), menuItem(dish));
};

/** What a section says when a filter leaves nothing in it, rather than a heading over an empty column. */
const emptyNotes = (entry: MenuSection): ElementSpec[] => [
  ...(entry.items.some(isVegetarian)
    ? []
    : [
        paragraph({
          content: 'Esta temporada no hay platos vegetarianos en esta sección.',
          class: 'emptyNote',
          visible: `state.${VEGETARIAN}`
        })
      ]),
  ...(entry.items.some(isGlutenFree)
    ? []
    : [
        paragraph({
          content: 'Esta temporada no hay platos sin gluten en esta sección.',
          class: 'emptyNote',
          visible: `state.${GLUTEN_FREE}`
        })
      ])
];

const menuSection = (entry: MenuSection): ElementSpec =>
  container({
    id: `carta-${entry.id}`,
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
        children: entry.unfiltered ? entry.items.map(menuItem) : [...entry.items.map(filterable), ...emptyNotes(entry)]
      })
    ]
  });

/**
 * A filter is a pill drawn twice, off and on, and one step flips it from either. Each copy says which it is with
 * `aria-pressed`, so a screen reader announces a toggle and its state rather than two buttons with the same name.
 */
const filterChip = (key: string, caption: string): ElementSpec[] => {
  const toggle = (): StepSpec[][] => [[onClick(), toggleState({ key })]];

  return [
    button({
      subType: 'button',
      content: caption,
      class: 'filterChip',
      ariaPressed: false,
      visible: `!state.${key}`,
      flows: toggle()
    }),
    button({
      subType: 'button',
      content: caption,
      class: 'filterChipActive',
      ariaPressed: true,
      visible: `state.${key}`,
      flows: toggle()
    })
  ];
};

const filters = container({
  id: 'carta-filtros',
  class: 'filterBar',
  children: [
    text({ content: 'Filtrar la carta', class: 'filterLabel' }),
    ...filterChip(VEGETARIAN, 'Vegetariano'),
    ...filterChip(GLUTEN_FREE, 'Sin gluten'),
    paragraph({
      content:
        'Si tienes alguna alergia o intolerancia, avísanos al reservar: adaptamos casi toda la carta. Precios con IVA incluido.',
      class: 'filterNote'
    })
  ]
});

export const carta: PageSpec = {
  id: 'carta',
  name: 'Carta',
  slug: 'carta',
  seoTitle: `La carta · ${restaurant.season} — Ceniza`,
  seoDescription: 'Platos para compartir cocinados sobre brasa de encina y sarmiento, con producto de temporada.',
  class: 'page',
  flows: closeMenuOnLoad(
    setState({ key: VEGETARIAN, type: 'boolean', value: false }),
    setState({ key: GLUTEN_FREE, type: 'boolean', value: false })
  ),
  body: shell('carta', [
    pageHero({
      id: 'carta-hero',
      titleId: 'carta-title',
      photoId: photos.greens,
      alt: 'Ensalada de hojas de temporada en un plato oscuro',
      kicker: `Carta · ${restaurant.season}`,
      title: 'La carta',
      lead: 'Platos pensados para el centro de la mesa. Cambiamos la carta con cada estación y con cada cosecha.',
      actions: [linkTo('/vinos', 'buttonOnPhoto', [label('Carta de vinos'), arrow()])]
    }),
    section([filters, ...menu.map(menuSection)]),
    container({
      subType: 'section',
      class: 'inkBand',
      children: [
        container({
          class: 'inkGrid',
          children: [
            image({
              src: photo(photos.cocktail, 1100),
              alt: 'Cóctel ahumado con romero sobre la barra',
              class: 'inkPhoto',
              loadMode: 'lazy'
            }),
            container({
              class: 'splitText',
              children: [
                eyebrow('¿Prefieres dejarte llevar?', 'inkEyebrow'),
                heading({ subType: 'h2', content: 'Deja que el fuego elija por ti.', class: 'inkTitle' }),
                paragraph({
                  content:
                    'El menú Brasa recorre la carta en nueve pasos, con maridaje de pequeños productores o una versión sin alcohol hecha en casa.',
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
            })
          ]
        })
      ]
    })
  ])
};
