/**
 * A row that scrolls sideways — swiped on a phone, moved by arrows elsewhere: the row's box scrolls
 * (`overflow-x: auto`), the arrows move it by most of what it shows, and `onScroll` hides each arrow at its end.
 */
import {
  button,
  container,
  list,
  named,
  onClick,
  onScroll,
  scrollBy,
  setState,
  styles,
  text,
  listItem
} from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const row = styles('card-row', {
  display: 'flex',
  gap: '16px',
  'overflow-x': 'auto',
  // Stops on a card, never between two.
  'scroll-snap-type': 'x mandatory',
  margin: '0px',
  padding: '0px',
  'list-style-type': 'none'
});

const card = styles('row-card', { 'flex-shrink': '0', width: '240px', padding: '16px', 'scroll-snap-align': 'start' });

const CATEGORIES = ['Processors', 'Graphics cards', 'Memory', 'Storage', 'Monitors', 'Keyboards', 'Mice', 'Cases'];

export const recipe: SpaceSpec = {
  name: 'Row',
  permanentUrl: 'row',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        container({
          children: [
            // Shown until the row says it is at that end: the arrows are there before anybody scrolls.
            button({
              content: '‹',
              title: 'Previous categories',
              visible: '!state.rowAtStart',
              flows: [[onClick(), scrollBy('categories', { x: '-80%' })]]
            }),
            list({
              id: 'categories',
              class: row,
              items: CATEGORIES,
              flows: [
                [
                  named('moved', onScroll()),
                  setState({ key: 'rowAtStart', type: 'boolean', value: '{{ moved.atStart }}' }),
                  setState({ key: 'rowAtEnd', type: 'boolean', value: '{{ moved.atEnd }}' })
                ]
              ],
              children: [listItem({ class: card, children: [text({ from: 'categories.item' })] })]
            }),
            button({
              content: '›',
              title: 'More categories',
              visible: '!state.rowAtEnd',
              flows: [[onClick(), scrollBy('categories', { x: '80%' })]]
            })
          ]
        })
      ]
    }
  ]
};
