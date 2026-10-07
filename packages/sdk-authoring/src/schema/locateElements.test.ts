import { describe, expect, it } from 'vitest';

import {
  bindTemplate,
  component,
  container,
  link,
  list,
  listItem,
  locateClasses,
  locateElements,
  styles,
  text
} from '../index';

describe('locateElements', () => {
  // `at` is the author's own code, and this test is inside the package: a project's elements carry it (see the CLI's
  // `plitzi element where`). What is checked here is the rest of what it answers about each one.
  it('answers every element the space authors to, with its classes, words and attributes', () => {
    const navLink = styles('nav-link', { desktop: { color: 'red' } });
    const located = locateElements({
      name: 'Where',
      permanentUrl: 'where',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [
            container({
              id: 'nav',
              children: [link({ id: 'nav-home', href: 'home', content: 'Home', class: navLink })]
            }),
            text('Hello', { id: 'greeting' }),
            text('', { id: 'score', bind: [bindTemplate('content', 'state.xp', '{{ source }} XP')] })
          ]
        }
      ]
    });

    expect(located.find(element => element.elementId === 'nav-home')).toMatchObject({
      type: 'link',
      rootId: 'home',
      classes: ['nav-link'],
      content: 'Home',
      attributes: { href: 'home' }
    });
    expect(located.find(element => element.elementId === 'greeting')).toMatchObject({
      type: 'text',
      content: 'Hello',
      bound: []
    });
    expect(located.find(element => element.elementId === 'score')).toMatchObject({
      bound: ['content'],
      templates: ['{{ source }} XP'],
      words: ['{{ source }} XP']
    });
    expect(located.find(element => element.elementId === 'nav-home')?.words).toEqual(['Home']);

    // A list handed its rows as data: the words its rows show are in its items.
    const plans = locateElements({
      name: 'Plans',
      permanentUrl: 'plans',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [
            list({
              id: 'plans',
              items: [{ name: 'Team', cta: 'Talk to sales' }],
              row: r => listItem({ id: 'plan', children: [text({ id: 'plan-cta', from: `${r.item}.cta` })] })
            })
          ]
        }
      ]
    });
    expect(plans.find(element => element.elementId === 'plans')?.words).toEqual(['Team', 'Talk to sales']);
    expect(located.map(element => element.elementId)).toEqual(expect.arrayContaining(['home', 'nav']));
  });

  it('answers the parts of a component, in the component', () => {
    const located = locateElements({
      name: 'Where',
      permanentUrl: 'where',
      components: [
        {
          id: 'card',
          props: { title: { type: 'text', description: 'Its title' } },
          root: container({ id: 'card-root', children: [text('Title', { id: 'card-title' })] })
        }
      ],
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [
            text('Hello', { id: 'greeting' }),
            component('card', { id: 'card-1', props: { title: 'Lamp' } }),
            link({ id: 'logo', href: 'home', label: 'Back home' })
          ]
        }
      ]
    });

    // The words an instance hands its component, and a label a screen reader says, are words it says too.
    expect(located.find(element => element.elementId === 'card-1')?.words).toEqual(['Lamp']);
    expect(located.find(element => element.elementId === 'logo')?.words).toEqual(['Back home']);

    expect(located.find(element => element.elementId === 'card-title')).toMatchObject({
      type: 'text',
      rootId: 'card',
      content: 'Title'
    });
  });

  // `at` is the author's code, and this test is inside the package: what is checked is that every class is answered.
  it('answers every class the space declares, by name', () => {
    const card = styles('card', { css: { padding: '8px' } });
    const located = locateClasses({
      name: 'Where',
      permanentUrl: 'where',
      pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ id: 'box', class: card })] }]
    });

    expect(located.map(found => found.name)).toContain('card');
  });
});
