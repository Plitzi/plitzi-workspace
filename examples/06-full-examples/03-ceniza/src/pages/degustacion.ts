import { container, heading, image, paragraph, text } from '@plitzi/sdk-authoring';

import { photo, photos, tastingMenu } from '../content.ts';
import {
  closeMenuOnLoad,
  eyebrow,
  icon,
  label,
  linkTo,
  noteItem,
  pageHero,
  section,
  sectionHead,
  shell
} from '../layout.ts';

import type { ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

const priceCard = (kicker: string, name: string, value: string, note: string, featured = false): ElementSpec =>
  container({
    class: featured ? 'priceCardFeatured' : 'priceCard',
    children: [
      eyebrow(kicker),
      heading({ subType: 'h3', content: name, class: 'priceCardName' }),
      text({ content: value, class: 'priceCardValue' }),
      paragraph({ content: note, class: 'priceCardNote' })
    ]
  });

export const degustacion: PageSpec = {
  id: 'degustacion',
  name: 'Menú degustación',
  slug: 'degustacion',
  seoTitle: 'Menú degustación Brasa — Ceniza',
  seoDescription: 'Nueve pasos alrededor del fuego, con maridaje de vinos naturales o sin alcohol.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('degustacion', [
    pageHero({
      id: 'degustacion-hero',
      titleId: 'degustacion-title',
      photoId: photos.fireKitchen,
      alt: 'Cocinero trabajando entre las llamas de la cocina',
      kicker: `${tastingMenu.name} · ${tastingMenu.steps} pasos`,
      title: 'Nueve pasos alrededor del fuego',
      lead: 'Un recorrido por la estación, de los aperitivos que salen de la brasa al último rescoldo del postre.',
      actions: [linkTo('/reservas', 'buttonPrimary', [label('Reservar el menú')])]
    }),
    section([
      sectionHead(
        'El recorrido',
        'Lo que llega a la mesa',
        'El orden y algunos ingredientes cambian con el mercado de la semana. Lo que no cambia es el fuego.',
        'degustacion-steps-title'
      ),
      container({
        id: 'degustacion-steps',
        subType: 'section',
        class: 'steps',
        children: tastingMenu.courses.map((course, index) =>
          container({
            class: 'step',
            children: [
              text({ content: String(index + 1).padStart(2, '0'), class: 'stepNumber' }),
              container({
                class: 'stack',
                children: [
                  heading({ subType: 'h3', content: course.name, class: 'stepName' }),
                  paragraph({ content: course.description, class: 'stepDescription' })
                ]
              })
            ]
          })
        )
      })
    ]),
    section(
      [
        sectionHead('Precios', 'Elige cómo acompañarlo', undefined, 'degustacion-prices-title'),
        container({
          class: 'priceGrid',
          children: [
            priceCard(
              'El recorrido completo',
              tastingMenu.name,
              tastingMenu.price,
              'Nueve pasos para compartir. Se sirve a toda la mesa.',
              true
            ),
            priceCard(
              'Para acompañar',
              'Maridaje de vinos',
              tastingMenu.pairing,
              'Seis copas de pequeños productores de Gredos y del Tajo.'
            ),
            priceCard(
              'Sin alcohol',
              'Maridaje sin alcohol',
              tastingMenu.pairingFree,
              'Kombuchas, fermentados y zumos de nuestra huerta.'
            )
          ]
        }),
        container({
          id: 'degustacion-vegetal',
          class: 'callout',
          children: [
            icon('fas fa-leaf', 'calloutIcon'),
            text({
              content: `${tastingMenu.vegetal.name}, ${tastingMenu.vegetal.price}: los mismos nueve pasos en versión vegetariana, con la huerta en el lugar del río y del fuego. Pídelo al reservar.`,
              class: 'calloutText'
            })
          ]
        })
      ],
      'sectionTight'
    ),
    section(
      [
        container({
          class: 'split',
          children: [
            container({
              class: 'splitMedia',
              children: [
                image({
                  src: photo(photos.trout, 1200),
                  alt: 'Trucha al sarmiento con salsa y hierbas frescas',
                  class: 'photoTall',
                  loadMode: 'lazy'
                })
              ]
            }),
            container({
              class: 'splitText',
              children: [
                sectionHead('Antes de venir', 'Para que todo salga redondo'),
                container({
                  class: 'noteList',
                  children: [
                    noteItem(`Duración aproximada de ${tastingMenu.duration}.`),
                    noteItem('El menú se sirve a toda la mesa, de 2 a 8 personas.'),
                    noteItem('Avísanos de alergias con 48 horas de antelación y adaptamos cada paso.'),
                    noteItem('Último pase a las 14:30 en comidas y a las 21:30 en cenas.')
                  ]
                }),
                container({
                  class: 'heroActions',
                  children: [
                    linkTo('/reservas', 'buttonPrimary', [label('Reservar el menú')]),
                    linkTo('/regalar', 'buttonGhost', [label('Regalar el menú')])
                  ]
                })
              ]
            })
          ]
        })
      ],
      'sectionTight'
    )
  ])
};
