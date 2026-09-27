import { container, heading, image, paragraph, text } from '@plitzi/sdk-authoring';

import { chef, milestones, photo, photos, pillars, producers, team } from '../content.ts';
import { closeMenuOnLoad, eyebrow, pageHero, pillarCard, section, sectionHead, shell, stat } from '../layout.ts';

import type { PageSpec } from '@plitzi/sdk-authoring';

const initials = (name: string): string =>
  name
    .split(' ')
    .map(word => word.charAt(0))
    .join('');

export const nosotros: PageSpec = {
  id: 'nosotros',
  name: 'Nosotros',
  slug: 'nosotros',
  seoTitle: 'Nuestra historia — Ceniza',
  seoDescription: 'Una casa construida alrededor de una brasa: fuego, temporada y seis productores a menos de 150 km.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('nosotros', [
    pageHero({
      id: 'nosotros-hero',
      titleId: 'nosotros-title',
      photoId: photos.sharedTable,
      alt: 'Amigos compartiendo una cena animada en el restaurante',
      kicker: 'Nuestra historia · Desde 2019',
      title: 'Una casa construida alrededor de una brasa',
      lead: 'Empezamos con una parrilla, seis mesas y la idea de cocinar solo lo que está en su mejor momento.'
    }),
    section([
      container({
        class: 'split',
        children: [
          container({
            class: 'splitText',
            children: [
              eyebrow('Cómo empezó'),
              heading({
                id: 'nosotros-story-title',
                subType: 'h2',
                content: 'De almacén de carbón a cocina de fuego.',
                class: 'sectionTitle'
              }),
              paragraph({
                content:
                  'Ceniza abrió en 2019 en un antiguo almacén de carbón del barrio de Las Letras. Conservamos las paredes ennegrecidas y construimos la cocina alrededor de lo único que ya estaba allí: el fuego.',
                class: 'sectionLead'
              }),
              paragraph({
                content:
                  'Siete años después seguimos cocinando igual: sin gas, con producto que conocemos por su nombre y con un equipo que se sienta a comer junto antes de cada servicio.',
                class: 'bodyText'
              }),
              container({
                class: 'statRow',
                children: [
                  stat('2019', 'abrimos las puertas'),
                  stat('38', 'personas en el equipo'),
                  stat('0', 'fogones de gas')
                ]
              })
            ]
          }),
          container({
            class: 'splitMedia',
            children: [
              image({
                src: photo(photos.produce, 1200),
                alt: 'Verduras de temporada recién llegadas de la huerta',
                class: 'photoTall',
                loadMode: 'lazy'
              })
            ]
          })
        ]
      })
    ]),
    section(
      [
        sectionHead('Lo que nos mueve', 'Tres ideas que no negociamos', undefined, 'nosotros-pillars-title'),
        container({ class: 'pillars', children: pillars.map(pillarCard) })
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
                  src: photo(photos.chefPlating, 1200),
                  alt: `${chef.name} terminando un plato en el pase`,
                  class: 'photoTall',
                  loadMode: 'lazy'
                })
              ]
            }),
            container({
              class: 'splitText',
              children: [
                eyebrow('El cocinero'),
                paragraph({
                  id: 'nosotros-chef-quote',
                  content:
                    '“El fuego no se controla, se escucha. Nuestro trabajo es elegir bien el producto y apartarnos a tiempo.”',
                  class: 'quoteLarge'
                }),
                container({
                  class: 'stack',
                  children: [
                    text({ content: chef.name, class: 'quoteName' }),
                    text({ content: chef.role, class: 'quoteRole' })
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
          'El equipo',
          'Las manos detrás del fuego',
          'Treinta y ocho personas entre cocina, sala, bodega y despensa. Estas son algunas de las que verás al pasar por el pase.',
          'nosotros-team-title'
        ),
        container({
          id: 'nosotros-team',
          class: 'teamGrid',
          children: team.map(member =>
            container({
              subType: 'article',
              class: 'teamCard',
              children: [
                container({ class: 'avatar', children: [text(initials(member.name))] }),
                text({ content: member.role, class: 'teamRole' }),
                heading({ subType: 'h3', content: member.name, class: 'teamName' }),
                paragraph({ content: member.bio, class: 'dishDescription' })
              ]
            })
          )
        })
      ],
      'sectionTight'
    ),
    section(
      [
        sectionHead('Siete años', 'Cómo hemos llegado hasta aquí', undefined, 'nosotros-timeline-title'),
        container({
          class: 'timeline',
          children: milestones.map(milestone =>
            container({
              class: 'milestone',
              children: [
                text({ content: milestone.year, class: 'milestoneYear' }),
                container({
                  class: 'stack',
                  children: [
                    heading({ subType: 'h3', content: milestone.title, class: 'stepName' }),
                    paragraph({ content: milestone.text, class: 'stepDescription' })
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
        sectionHead(
          'Productores',
          'Seis casas, a menos de 150 km',
          'Cada semana hablamos con ellos antes de escribir la carta. Lo que nos traen decide lo que cocinamos.',
          'nosotros-producers-title'
        ),
        container({
          class: 'producers',
          children: producers.map(producer =>
            container({
              class: 'producer',
              children: [
                container({
                  class: 'stack',
                  children: [
                    text({ content: producer.name, class: 'producerName' }),
                    text({ content: `${producer.product} · ${producer.place}`, class: 'producerMeta' })
                  ]
                }),
                text({ content: producer.distance, class: 'distance' })
              ]
            })
          )
        }),
        container({
          class: 'gallery',
          children: [
            image({
              src: photo(photos.fireKitchen, 900),
              alt: 'Llamas en la cocina',
              class: 'galleryImage',
              loadMode: 'lazy'
            }),
            image({
              src: photo(photos.bread, 700),
              alt: 'Pan de masa madre recién horneado',
              class: 'galleryImage',
              loadMode: 'lazy'
            }),
            image({
              src: photo(photos.toast, 700),
              alt: 'Brindis con vino tinto',
              class: 'galleryImage',
              loadMode: 'lazy'
            })
          ]
        })
      ],
      'sectionTight'
    )
  ])
};
