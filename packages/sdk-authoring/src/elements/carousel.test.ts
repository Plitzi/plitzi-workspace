import { describe, expect, it } from 'vitest';

import {
  activeWhen,
  apiContainer,
  bindTemplate,
  authorSpace,
  button,
  carousel,
  carouselGoTo,
  carouselNext,
  carouselPrevious,
  container,
  list,
  onClick,
  styles,
  text
} from '../index';

import type { ComponentSpec, ElementSpec, SpaceSpec } from '../schema';

const card: ComponentSpec = {
  id: 'slide-card',
  props: { item: { type: 'json', description: 'The slide' } },
  root: container({ id: 'slide-card-root', children: [text({ id: 'slide-card-title', from: 'props.item.title' })] })
};

const page = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Carousels',
  permanentUrl: 'carousels',
  components: [card],
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [apiContainer({ id: 'site', query: '/data/home.json', children: body })]
    }
  ]
});

const dot = styles('dot', {
  css: { width: 8, height: 8, borderRadius: '999px', backgroundColor: '#ccc' },
  variants: { active: { backgroundColor: '#333' } }
});

describe('a carousel', () => {
  it('writes its row into a track, and its children beside it as the controls', () => {
    const hero = carousel({
      id: 'hero',
      items: 'site.data.slides',
      autoplay: 5000,
      row: r => text({ from: `${r.item}.title` }),
      children: [button({ content: 'Next', flows: [[onClick(), carouselNext('hero')]] })]
    });

    expect(hero.bind).toEqual([{ to: 'items', source: 'site.data.slides' }]);
    expect(hero.children?.map(child => child.type)).toEqual(['carouselTrack', 'button']);
    expect(hero.children?.[0].children?.[0].from).toBe('hero.item.title');
  });

  it('authors as a whole: slides, arrows and dots that know which slide is showing', () => {
    const authored = authorSpace(
      page([
        carousel({
          id: 'hero',
          label: 'Featured',
          items: 'site.data.slides',
          row: 'slide-card',
          children: [
            button({ content: '‹', title: 'Previous', flows: [[onClick(), carouselPrevious('hero')]] }),
            button({ content: '›', title: 'Next', flows: [[onClick(), carouselNext('hero')]] }),
            list({
              id: 'dots',
              items: 'hero.items',
              row: r =>
                button({
                  content: '',
                  class: dot,
                  bind: [
                    bindTemplate('title', r.index, 'Slide {{ source + 1 }}'),
                    activeWhen(dot, `{{ ${r.inTemplate.index} == carousel_hero.index }}`)
                  ],
                  flows: [[onClick(), carouselGoTo('hero', `{{ ${r.inTemplate.index} }}`)]]
                })
            })
          ]
        })
      ])
    );

    expect(authored.warnings).toEqual([]);
    const track = Object.values(authored.schema.flat).find(element => element.definition.type === 'carouselTrack');
    expect(track?.definition.items).toHaveLength(1);
  });

  it('is told to move only where a carousel is', () => {
    expect(() =>
      authorSpace(
        page([
          text({ id: 'not-one', content: 'x' }),
          button({ content: 'Next', flows: [[onClick(), carouselNext('not-one')]] })
        ])
      )
    ).toThrow();
  });
});
