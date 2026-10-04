/**
 * Three carousels from one element: slides that change on their own with arrows and dots, a marquee of logos that
 * never ends, and a row of cards a visitor swipes. The slides, the dots and anything else inside read the carousel's
 * source — `carousel_<id>.index`, `.count`, `.item`, `.items` — and the arrows and dots are steps on it.
 */
import {
  activeWhen,
  bindTemplate,
  button,
  carousel,
  carouselGoTo,
  carouselNext,
  carouselPrevious,
  container,
  heading,
  list,
  onClick,
  styles,
  text,
  listItem
} from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const SLIDES = [
  { id: 'one', title: 'Lamps', lede: 'Warm light for long evenings' },
  { id: 'two', title: 'Paper', lede: 'Notebooks that lie flat' },
  { id: 'three', title: 'Pens', lede: 'Six colours, quick to dry' }
];

const slide = styles('hero-slide', { padding: '64px 32px', backgroundColor: 'var(--card)', borderRadius: '16px' });

const dot = styles('hero-dot', {
  css: { width: 10, height: 10, padding: '0px', borderRadius: '999px', backgroundColor: 'var(--muted)' },
  variants: { active: { backgroundColor: 'var(--primary)' } }
});

const dots = styles('hero-dots', { display: 'flex', gap: 8, margin: '0px', padding: '0px', listStyleType: 'none' });

// Several slides at once: the carousel's class says how wide each is and the gap between them.
const cards = styles('picks-row', { '--plitzi-carousel-slide-width': '240px', '--plitzi-carousel-gap': '16px' });

export const recipe: SpaceSpec = {
  name: 'Carousels',
  permanentUrl: 'carousels',
  variables: {
    color: {
      card: { light: '#f4f4f8', dark: '#1c1c22', default: '#f4f4f8' },
      muted: { light: '#c4c4cc', dark: '#3a3a44', default: '#c4c4cc' },
      primary: { light: '#4f46e5', dark: '#818cf8', default: '#4f46e5' }
    }
  },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        // One slide at a time, on its own every 5 s — held while the pointer or the keyboard is on it.
        carousel({
          id: 'hero',
          label: 'Featured',
          items: SLIDES,
          autoplay: 5000,
          row: r =>
            container({
              class: slide,
              children: [heading({ subType: 'h2', from: `${r.item}.title` }), text({ from: `${r.item}.lede` })]
            }),
          children: [
            button({ content: '‹', title: 'Previous slide', flows: [[onClick(), carouselPrevious('hero')]] }),
            button({ content: '›', title: 'Next slide', flows: [[onClick(), carouselNext('hero')]] }),
            list({
              id: 'hero-dots',
              class: dots,
              items: 'hero.items',
              row: r =>
                listItem({
                  children: [
                    button({
                      content: '',
                      class: dot,
                      bind: [
                        bindTemplate('title', r.index, 'Slide {{ source + 1 }}'),
                        activeWhen(dot, `{{ ${r.inTemplate.index} == carousel_hero.index }}`)
                      ],
                      flows: [[onClick(), carouselGoTo('hero', `{{ ${r.inTemplate.index} }}`)]]
                    })
                  ]
                })
            })
          ]
        }),
        // Scrolling past for ever at 40 px a second, still under the pointer.
        carousel({
          id: 'logos',
          label: 'Brands we carry',
          mode: 'marquee',
          speed: 40,
          items: ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli'],
          row: r => text({ from: r.item, css: { padding: '0px 24px', fontWeight: 600 } })
        }),
        // A row that swipes on a phone and snaps to each card; the arrows move it a card at a time.
        carousel({
          id: 'picks',
          label: 'Picks',
          mode: 'scroll',
          class: cards,
          items: SLIDES,
          row: r => container({ class: slide, children: [text({ from: `${r.item}.title` })] }),
          children: [
            button({ content: '›', title: 'More picks', flows: [[onClick(), carouselNext('picks')]] }),
            text({ from: 'picks.index', as: '{{ source + 1 }} of {{ carousel_picks.count }}' })
          ]
        })
      ]
    }
  ]
};
