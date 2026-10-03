/**
 * A marquee: a row of names that scrolls for ever and stops under the pointer. The items are rendered three times
 * and the keyframe moves the track by a third, so the end meets the start with no jump.
 */
import { apiContainer, container, list, styles, text } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const marquee = styles('marquee', { overflow: 'hidden' });

const track = styles('marquee-track', {
  css: {
    display: 'flex',
    gap: '48px',
    width: 'max-content',
    margin: '0px',
    padding: '0px',
    'list-style-type': 'none',
    animation: 'marquee 30s linear infinite'
  },
  // An ancestor's state reaches inside it: hovering the band pauses the track.
  ancestors: { [marquee.name]: { states: { hover: { 'animation-play-state': 'paused' } } } }
});

export const recipe: SpaceSpec = {
  name: 'Marquee',
  permanentUrl: 'marquee',
  customCss: '@keyframes marquee { to { transform: translateX(calc(-100% / 3)); } }',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        apiContainer({
          id: 'catalog',
          query: '/data/brands.json',
          cache: true,
          children: [
            container({
              class: marquee,
              children: [
                list({
                  id: 'brands',
                  class: track,
                  from: 'catalog.data.brands',
                  as: '{{ source|merge(source)|merge(source) }}',
                  children: [text({ from: 'brands.item' })]
                })
              ]
            })
          ]
        })
      ]
    }
  ]
};
