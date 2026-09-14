import { container, heading, image, paragraph, text } from '@plitzi/sdk-authoring';

import { dietLabels, photo, photos, restaurant, seasonal, signatureDishes, testimonials } from '../content';
import {
  arrow,
  closeMenuOnLoad,
  externalLink,
  eyebrow,
  hours,
  icon,
  infoRow,
  label,
  linkTo,
  newsletter,
  section,
  sectionHead,
  shell,
  stat
} from '../layout';
import { articleList, journalProvider } from './diario';

import type { Dish } from '../content';
import type { ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

export const tags = (dish: Dish): ElementSpec[] =>
  dish.tags?.length
    ? [container({ class: 'tagRow', children: dish.tags.map(tag => text({ content: dietLabels[tag], class: 'tag' })) })]
    : [];

const fact = (value: string, caption: string): ElementSpec =>
  container({
    class: 'stack',
    children: [text({ content: value, class: 'heroFactValue' }), text({ content: caption, class: 'heroFactLabel' })]
  });

const price = (value: string, caption: string): ElementSpec =>
  container({
    class: 'stack',
    children: [text({ content: value, class: 'priceValue' }), text({ content: caption, class: 'priceLabel' })]
  });

const hero = container({
  id: 'home-hero',
  subType: 'section',
  class: 'hero',
  children: [
    image({
      src: photo(photos.heroTable, 2200),
      alt: 'Mesa servida con un plato de autor y copas de vino a la luz de las velas',
      class: 'heroImage',
      fetchPriority: 'high',
      loadMode: 'eager'
    }),
    container({ class: 'heroScrim' }),
    container({
      class: 'heroContent',
      children: [
        container({
          class: 'heroEyebrow',
          children: [icon('fas fa-fire'), text(`${restaurant.city} · ${restaurant.tagline}`)]
        }),
        heading({
          id: 'home-title',
          subType: 'h1',
          content: 'Donde el fuego se convierte en memoria.',
          class: 'heroTitle'
        }),
        paragraph({
          content:
            'Cocinamos sobre brasa de encina con producto de productores cercanos. Una carta que cambia con cada estación y una sala pensada para comer sin prisa.',
          class: 'heroLead'
        }),
        container({
          class: 'heroActions',
          children: [
            linkTo('/reservas', 'buttonPrimary', [label('Reservar mesa')]),
            linkTo('/carta', 'buttonOnPhoto', [label('Ver la carta'), arrow()])
          ]
        }),
        container({
          class: 'heroFacts',
          children: [
            fact('4,9 / 5', 'Valoración media en 2.300 reseñas'),
            fact('9 pasos', 'Menú degustación Brasa'),
            fact('< 150 km', 'De la huerta a la mesa')
          ]
        })
      ]
    })
  ]
});

const strip = container({
  class: 'strip',
  children: [
    container({
      class: 'stripInner',
      children: [
        ['fas fa-fire', 'Brasa de encina'],
        ['fas fa-seedling', 'Producto de temporada'],
        ['fas fa-wine-glass', 'Vinos naturales'],
        ['fas fa-recycle', 'Cocina de residuo cero']
      ].map(([iconName = '', caption = '']) =>
        container({ class: 'stripItem', children: [icon(iconName, 'stripIcon'), text(caption)] })
      )
    })
  ]
});

const story = section([
  container({
    class: 'split',
    children: [
      container({
        class: 'splitMedia',
        children: [
          image({
            src: photo(photos.chefKnife, 1200),
            alt: 'Cocinero cortando verduras frescas sobre una tabla',
            class: 'photoTall',
            loadMode: 'lazy'
          }),
          container({
            class: 'photoBadge',
            children: [
              text({ content: '12 h', class: 'badgeValue' }),
              text({ content: 'de brasa lenta para la costilla', class: 'badgeLabel' })
            ]
          })
        ]
      }),
      container({
        class: 'splitText',
        children: [
          eyebrow('Nuestra cocina'),
          heading({
            id: 'home-story-title',
            subType: 'h2',
            content: 'Una cocina sin atajos, alrededor de una sola brasa.',
            class: 'sectionTitle'
          }),
          paragraph({
            content:
              'En Ceniza no hay gas en la cocina caliente. Todo pasa por el fuego: la encina para la carne, el sarmiento para el pescado y el rescoldo para los postres.',
            class: 'sectionLead'
          }),
          paragraph({
            content:
              'Fermentamos, curamos y horneamos en casa. Lo que no está en su mejor momento no entra en la carta, y lo que sobra vuelve a la cocina en forma de caldo, encurtido o miso.',
            class: 'bodyText'
          }),
          container({
            class: 'statRow',
            children: [
              stat('6', 'productores de confianza'),
              stat('4', 'cartas al año'),
              stat('48 h', 'de fermentación')
            ]
          }),
          linkTo('/nosotros', 'textLink', [label('Conoce nuestra historia'), arrow()])
        ]
      })
    ]
  })
]);

const dishCard = (dish: (typeof signatureDishes)[number]): ElementSpec =>
  container({
    subType: 'article',
    class: 'dishCard',
    children: [
      image({ src: photo(dish.photo, 900), alt: dish.name, class: 'dishImage', loadMode: 'lazy' }),
      container({
        class: 'dishBody',
        children: [
          container({
            class: 'dishTop',
            children: [
              heading({ subType: 'h3', content: dish.name, class: 'dishName' }),
              text({ content: dish.price, class: 'price' })
            ]
          }),
          paragraph({ content: dish.description, class: 'dishDescription' }),
          ...tags(dish)
        ]
      })
    ]
  });

const signature = section(
  [
    container({
      class: 'sectionHeadRow',
      children: [
        sectionHead(
          'De la carta',
          'Los platos que nos definen',
          'Tres clásicos de la casa que nunca salen de la carta, solo cambian de guarnición con la estación.',
          'home-dishes-title'
        ),
        linkTo('/carta', 'buttonGhost', [label('Ver la carta completa')])
      ]
    }),
    container({ id: 'home-dishes', class: 'dishGrid', children: signatureDishes.map(dishCard) })
  ],
  'sectionTight'
);

const season = section(
  [
    container({
      class: 'sectionHeadRow',
      children: [
        sectionHead(
          `Esta temporada · ${restaurant.season}`,
          'Lo que llega ahora a la brasa',
          'La carta sigue al campo. Estos son los productos que marcan el otoño en nuestra cocina.',
          'home-season-title'
        ),
        linkTo('/nosotros', 'buttonGhost', [label('Nuestros productores')])
      ]
    }),
    container({
      id: 'home-season',
      class: 'seasonGrid',
      children: seasonal.map(product =>
        container({
          subType: 'article',
          class: 'seasonCard',
          children: [
            image({ src: photo(product.photo, 700), alt: product.alt, class: 'seasonImage', loadMode: 'lazy' }),
            container({
              class: 'seasonBody',
              children: [
                text({ content: product.months, class: 'seasonMonths' }),
                heading({ subType: 'h3', content: product.name, class: 'seasonName' }),
                paragraph({ content: product.note, class: 'dishDescription' })
              ]
            })
          ]
        })
      )
    })
  ],
  'sectionTight'
);

const tasting = container({
  subType: 'section',
  class: 'inkBand',
  children: [
    container({
      class: 'inkGrid',
      children: [
        container({
          class: 'splitText',
          children: [
            eyebrow('Menú degustación', 'inkEyebrow'),
            heading({
              id: 'home-tasting-title',
              subType: 'h2',
              content: 'Nueve pasos alrededor del fuego.',
              class: 'inkTitle'
            }),
            paragraph({
              content:
                'Un recorrido por la estación de principio a fin: de los aperitivos que salen de la brasa al último rescoldo del postre. Para compartir con toda la mesa.',
              class: 'inkLead'
            }),
            container({
              class: 'priceRow',
              children: [price('95 €', 'Menú Brasa'), price('+ 55 €', 'Maridaje'), price('2 h 30', 'Duración')]
            }),
            container({
              class: 'heroActions',
              children: [
                linkTo('/degustacion', 'buttonOnInk', [label('Descubrir el menú')]),
                linkTo('/reservas', 'buttonOnPhoto', [label('Reservar'), arrow()])
              ]
            })
          ]
        }),
        image({
          src: photo(photos.chefPlating, 1100),
          alt: 'Cocinero emplatando bajo las lámparas del pase',
          class: 'inkPhoto',
          loadMode: 'lazy'
        })
      ]
    })
  ]
});

const reviews = section([
  sectionHead('Lo que dicen', 'Una mesa a la que se vuelve', undefined, 'home-reviews-title'),
  container({
    class: 'quoteGrid',
    children: testimonials.map(review =>
      container({
        subType: 'figure',
        class: 'quoteCard',
        children: [
          text({ content: '★★★★★', class: 'stars' }),
          paragraph({ content: `“${review.quote}”`, class: 'quoteText' }),
          container({
            class: 'stack',
            children: [
              text({ content: review.name, class: 'quoteName' }),
              text({ content: review.role, class: 'quoteRole' })
            ]
          })
        ]
      })
    )
  })
]);

interface Promo {
  photoId: string;
  alt: string;
  kicker: string;
  title: string;
  lead: string;
  href: string;
  cta: string;
}

const promo = ({ photoId, alt, kicker, title, lead, href, cta }: Promo): ElementSpec =>
  container({
    subType: 'article',
    class: 'promoCard',
    children: [
      image({ src: photo(photoId, 1100), alt, class: 'coverImage', loadMode: 'lazy' }),
      container({ class: 'promoScrim' }),
      container({
        class: 'promoContent',
        children: [
          eyebrow(kicker, 'inkEyebrow'),
          heading({ subType: 'h3', content: title, class: 'promoTitle' }),
          paragraph({ content: lead, class: 'inkLead' }),
          linkTo(href, 'buttonOnInk', [label(cta)])
        ]
      })
    ]
  });

const promos = section(
  [
    container({
      id: 'home-promos',
      class: 'pairGrid',
      children: [
        promo({
          photoId: photos.gift,
          alt: 'Manos sosteniendo un regalo envuelto en papel kraft',
          kicker: 'Tarjetas regalo',
          title: 'Regala una noche junto al fuego',
          lead: 'Importe libre o el menú Brasa para dos. Llega al email en minutos y vale un año.',
          href: '/regalar',
          cta: 'Ver tarjetas regalo'
        }),
        promo({
          photoId: photos.sharedTable,
          alt: 'Grupo de amigos celebrando alrededor de una mesa',
          kicker: 'Eventos privados',
          title: 'Toda la casa, para tu celebración',
          lead: 'De 10 a 90 personas, con menú a medida y la brasa encendida solo para vosotros.',
          href: '/eventos',
          cta: 'Organizar un evento'
        })
      ]
    })
  ],
  'sectionTight'
);

const journal = section(
  [
    container({
      class: 'sectionHeadRow',
      children: [
        sectionHead(
          'Diario',
          'Historias desde la cocina',
          'Productores, técnicas y todo lo que pasa antes de que un plato salga del pase.',
          'home-journal-title'
        ),
        linkTo('/diario', 'buttonGhost', [label('Leer el diario')])
      ]
    }),
    journalProvider('homeJournal', [articleList('homeJournalList', 'homeJournal.records', 'journalGrid')])
  ],
  'sectionTight'
);

const visit = section(
  [
    container({
      class: 'visitGrid',
      children: [
        container({
          id: 'home-visit',
          class: 'infoCard',
          children: [
            sectionHead('Visítanos', 'Te guardamos sitio junto a la brasa.'),
            infoRow('fas fa-location-dot', 'Dirección', text({ content: restaurant.address, class: 'infoValue' })),
            infoRow(
              'fas fa-phone',
              'Teléfono',
              externalLink(restaurant.phoneHref, 'infoLink', [label(restaurant.phone)])
            ),
            hours('homeHours'),
            linkTo('/reservas', 'buttonWide', [label('Reservar mesa')])
          ]
        }),
        container({
          class: 'photoFrame',
          children: [
            image({
              src: photo(photos.darkRoom, 1200),
              alt: 'Sala del restaurante con luz cálida y mesas de madera',
              class: 'coverImage',
              loadMode: 'lazy'
            })
          ]
        })
      ]
    })
  ],
  'sectionTight'
);

export const inicio: PageSpec = {
  id: 'inicio',
  name: 'Inicio',
  slug: '',
  isDefault: true,
  seoTitle: 'Ceniza — Cocina de fuego y temporada en Madrid',
  seoDescription:
    'Restaurante de cocina a la brasa en Madrid. Producto de temporada, menú degustación de nueve pasos y vinos naturales.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('inicio', [
    hero,
    strip,
    story,
    signature,
    season,
    tasting,
    reviews,
    promos,
    journal,
    visit,
    newsletter('boletinInicio')
  ])
};
