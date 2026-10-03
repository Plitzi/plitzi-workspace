/**
 * Something every few seconds — here a carousel that turns by itself: `onInterval` moves `state.slide` on, a hover
 * pauses it, arrows and dots move it by hand, and each slide enters with an animation.
 *
 * Every slide is rendered and all but one hidden by `visible`. A hidden element is `display: none`, so its CSS
 * animation runs again each time it is shown: that is the entrance. The clock ticks only while the tab is in view.
 */
import {
  button,
  container,
  cycleState,
  heading,
  list,
  on,
  onClick,
  onInterval,
  setState,
  styles,
  text,
  activeWhen,
  when
} from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const SLIDES = [
  { title: 'New in store', body: 'This week’s arrivals.' },
  { title: 'Free delivery', body: 'On orders over 50 €.' },
  { title: 'Trade in', body: 'Your old card, against a new one.' }
];

// The slide after the last is the first: a cycle as long as the slides.
const next = cycleState({ key: 'slide', length: SLIDES.length });
const previous = cycleState({ key: 'slide', length: SLIDES.length, by: -1 });

const slide = styles('slide', { padding: '48px 24px', animation: 'slide-in 400ms ease-out' });

const dots = styles('dots', { display: 'flex', gap: '8px', margin: '0px', padding: '0px', 'list-style-type': 'none' });

const dot = styles('dot', {
  css: {
    width: '10px',
    height: '10px',
    padding: '0px',
    'border-radius': '999px',
    border: '0px solid transparent',
    'background-color': 'var(--muted)'
  },
  variants: { active: { 'background-color': 'var(--primary)' } }
});

export const recipe: SpaceSpec = {
  name: 'Carousel',
  permanentUrl: 'carousel',
  variables: {
    color: {
      muted: { light: '#c4c4cc', dark: '#3a3a44', default: '#c4c4cc' },
      primary: { light: '#4f46e5', dark: '#818cf8', default: '#4f46e5' }
    }
  },
  customCss:
    '@keyframes slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        container({
          id: 'carousel',
          subType: 'section',
          label: 'Offers',
          flows: [
            // Each tick turns it, unless the pointer is on it.
            [onInterval(5000), when({ field: 'state.carouselPaused', operator: '!=', value: 'true' }, next)],
            [on('onMouseEnter'), setState({ key: 'carouselPaused', type: 'boolean', value: true })],
            [on('onMouseLeave'), setState({ key: 'carouselPaused', type: 'boolean', value: false })]
          ],
          children: [
            list({
              id: 'slides',
              items: SLIDES,
              children: [
                container({
                  class: slide,
                  visible: { source: 'slides.index', template: '{{ source == (state.slide ?? 0) }}' },
                  children: [heading({ subType: 'h2', from: 'slides.item.title' }), text({ from: 'slides.item.body' })]
                })
              ]
            }),
            button({
              content: 'Previous',
              flows: [[onClick(), previous]]
            }),
            button({
              content: 'Next',
              flows: [[onClick(), next]]
            }),
            list({
              id: 'dots',
              class: dots,
              items: SLIDES,
              children: [
                button({
                  content: '',
                  title: 'Show this offer',
                  class: dot,
                  bind: [activeWhen(dot, '{{ list_dots.index == (state.slide ?? 0) }}')],
                  flows: [[onClick(), setState({ key: 'slide', type: 'number', value: '{{ list_dots.index }}' })]]
                })
              ]
            }),
            text({ from: 'state.slide', as: '{{ (source ?? 0) + 1 }} of 3' })
          ]
        })
      ]
    }
  ]
};
