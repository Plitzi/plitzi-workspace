import { describe, expect, it } from 'vitest';

import { bindTemplate, container, link, locateElements, styles, text } from '../index';

describe('locateElements', () => {
  // `at` is the author's own code, and this test is inside the package: a project's elements carry it (see the CLI's
  // `plitzi where`). What is checked here is the rest of what it answers about each one.
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
      templates: ['{{ source }} XP']
    });
    expect(located.map(element => element.elementId)).toEqual(expect.arrayContaining(['home', 'nav']));
  });

  it('answers the parts of a component, in the component', () => {
    const located = locateElements({
      name: 'Where',
      permanentUrl: 'where',
      components: [
        { id: 'card', root: container({ id: 'card-root', children: [text('Title', { id: 'card-title' })] }) }
      ],
      pages: [{ id: 'home', name: 'Home', slug: '', body: [text('Hello', { id: 'greeting' })] }]
    });

    expect(located.find(element => element.elementId === 'card-title')).toMatchObject({
      type: 'text',
      rootId: 'card',
      content: 'Title'
    });
  });
});
