import { container, heading, image, paragraph, text } from '@plitzi/sdk-authoring';

import { eventSteps, events, faqs, photo, photos, restaurant, rooms } from '../content';
import {
  arrow,
  closeMenuOnLoad,
  externalLink,
  eyebrow,
  faqList,
  icon,
  label,
  linkTo,
  pageHero,
  processGrid,
  section,
  sectionHead,
  shell
} from '../layout';

import type { PageSpec } from '@plitzi/sdk-authoring';

export const eventos: PageSpec = {
  id: 'eventos',
  name: 'Eventos',
  slug: 'eventos',
  seoTitle: 'Eventos privados y agenda — Ceniza',
  seoDescription: 'Cenas privadas, bodas íntimas y eventos de empresa de 10 a 90 personas. Agenda de cenas especiales.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('eventos', [
    pageHero({
      id: 'eventos-hero',
      titleId: 'eventos-title',
      photoId: photos.toast,
      alt: 'Brindis con copas de vino tinto durante una celebración',
      kicker: 'Eventos y grupos',
      title: 'Celebraciones con sabor a brasa',
      lead: 'Cenas privadas, bodas íntimas y encuentros de empresa. Diseñamos el menú contigo, de 10 a 90 personas.',
      actions: [externalLink(`mailto:${restaurant.email}`, 'buttonPrimary', [label('Pedir presupuesto')])]
    }),
    section([
      sectionHead('Espacios', 'Tres formas de tener Ceniza para ti', undefined, 'eventos-rooms-title'),
      container({
        id: 'eventos-rooms',
        class: 'roomGrid',
        children: rooms.map(room =>
          container({
            subType: 'article',
            class: 'dishCard',
            children: [
              image({ src: photo(room.photo, 900), alt: room.name, class: 'roomImage', loadMode: 'lazy' }),
              container({
                class: 'dishBody',
                children: [
                  container({ class: 'capacity', children: [icon('fas fa-users'), text(room.capacity)] }),
                  heading({ subType: 'h3', content: room.name, class: 'dishName' }),
                  paragraph({ content: room.description, class: 'dishDescription' })
                ]
              })
            ]
          })
        )
      })
    ]),
    section(
      [
        sectionHead(
          'Cómo funciona',
          'De la primera idea a la sobremesa',
          'Un único interlocutor desde el primer correo hasta que se apaga la última vela.',
          'eventos-steps-title'
        ),
        processGrid(eventSteps, 'eventos-steps')
      ],
      'sectionTight'
    ),
    section(
      [
        sectionHead(
          'Agenda',
          'Próximas citas en la cocina',
          'Plazas limitadas. Las cenas especiales se reservan por persona y se sirven en mesas compartidas.',
          'eventos-agenda-title'
        ),
        container({
          class: 'eventList',
          children: events.map(event =>
            container({
              subType: 'article',
              class: 'eventRow',
              children: [
                container({
                  class: 'eventDate',
                  children: [
                    text({ content: event.day, class: 'eventDay' }),
                    text({ content: event.month, class: 'eventMonth' })
                  ]
                }),
                container({
                  class: 'eventBody',
                  children: [
                    heading({ subType: 'h3', content: event.title, class: 'eventTitle' }),
                    paragraph({ content: event.description, class: 'stepDescription' })
                  ]
                }),
                container({
                  class: 'eventAside',
                  children: [
                    text({ content: `${event.price} / persona`, class: 'price' }),
                    linkTo('/reservas', 'buttonGhost', [label('Reservar plaza')])
                  ]
                })
              ]
            })
          )
        })
      ],
      'sectionTight'
    ),
    section(
      [
        sectionHead('Preguntas', 'Lo que suele preguntarse antes de un evento', undefined, 'eventos-faq-title'),
        faqList('faqEventos', faqs.eventos)
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
                eyebrow('A medida', 'inkEyebrow'),
                heading({ subType: 'h2', content: '¿Tienes una fecha en mente?', class: 'inkTitle' }),
                paragraph({
                  content:
                    'Cuéntanos qué celebras, cuántos seréis y qué os gusta. Te respondemos en menos de 24 horas con una propuesta de menú y espacio.',
                  class: 'inkLead'
                }),
                container({
                  class: 'heroActions',
                  children: [
                    externalLink(`mailto:${restaurant.email}`, 'buttonOnInk', [label('Escríbenos')]),
                    externalLink(restaurant.phoneHref, 'buttonOnPhoto', [label(restaurant.phone), arrow()])
                  ]
                })
              ]
            }),
            image({
              src: photo(photos.terrace, 1100),
              alt: 'Patio con plantas y mesas preparado para un evento',
              class: 'inkPhoto',
              loadMode: 'lazy'
            })
          ]
        })
      ]
    })
  ])
};
