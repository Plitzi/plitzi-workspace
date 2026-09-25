/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
import { describe, expect, it } from 'vitest';

import {
  apiContainer,
  authorSpace,
  bindTemplate,
  button,
  declaredCallback,
  declaredTrigger,
  defineElement,
  form,
  formControl,
  link,
  list,
  modalContainer,
  named,
  onClick,
  onSubmit,
  openModal,
  setState,
  text
} from './index';

/**
 * The recipes the skill hands an agent (`skills/plitzi-authoring/SKILL.md`, "Recipes"), exactly as written there.
 *
 * They are what a less capable model copies without reading anything else, so they have to author on the first try,
 * with no warning. If this fails, fix the recipe in the skill in the same change.
 */
/** The plugin the recipes use: a declaration as `plitzi add plugin` writes one. */
const declaration = {
  type: 'seatPicker',
  triggers: { onPick: { action: 'onPick', title: 'On Pick', type: 'trigger', params: {}, preview: { seat: '' } } },
  callbacks: { reset: { action: 'reset', title: 'Reset', type: 'callback', params: {} } },
  content: { attributes: { rows: 10 }, definition: { label: 'Seat Picker' } }
} as const;

type SeatPickerAttributes = { rows?: number };

describe('the skill’s recipes', () => {
  it('author together, with no warning', () => {
    const seats = defineElement<SeatPickerAttributes>(declaration);
    const { warnings } = authorSpace(
      {
        name: 'Recipes',
        permanentUrl: 'recipes',
        computed: { xp: '{{ (state.favourites|length) * 10 }}' },
        pages: [
          {
            id: 'home',
            name: 'Home',
            slug: '',
            isDefault: true,
            body: [
              apiContainer({
                id: 'catalog',
                query: '/data/games.json',
                cache: true,
                children: [
                  list({
                    id: 'games',
                    source: 'controlled',
                    bind: { items: 'catalog.data.games' },
                    children: [
                      link({
                        mode: 'internal',
                        href: '/games/{{ list_games.item.slug }}',
                        children: [text('', { bind: { content: 'games.item.title' } })]
                      })
                    ]
                  }),
                  list({
                    id: 'shown',
                    source: 'controlled',
                    bind: [
                      bindTemplate('items', 'catalog.data.games', '{{ source|filter(g => g.genre == state.genre) }}', {
                        returns: 'value'
                      })
                    ],
                    children: [text('row')]
                  }),
                  text('', { bind: [bindTemplate('content', 'catalog.data.games', '{{ source|length }} games')] }),
                  text('Nothing here yet', {
                    visible: {
                      source: 'catalog.data.games',
                      template: "{{ source is defined and source|length == 0 ? 'true' : 'false' }}"
                    }
                  })
                ]
              }),
              text('', { bind: [bindTemplate('content', 'computed.xp', '{{ source }} XP')] }),
              button({
                content: 'Save',
                flows: [[onClick(), setState({ key: 'saved', type: 'boolean', value: true })]]
              }),
              form({
                id: 'signup',
                managedByInteractions: true,
                flows: [
                  [
                    named('sent', onSubmit()),
                    setState({ key: 'email', type: 'text', value: '{{ sent.values.email }}' })
                  ]
                ],
                children: [
                  formControl({ name: 'email', label: 'Email', subType: 'email' }),
                  button({ content: 'Sign up', subType: 'submit' })
                ]
              }),
              modalContainer({ id: 'details', visible: false, title: 'Details', children: [text('Details')] }),
              button({ content: 'Open', flows: [[onClick(), openModal('details')]] }),
              link({ href: 'about', children: [text('About')] }),
              link({ href: '/games/nebula', mode: 'internal', children: [text('Nebula')] }),
              seats({
                id: 'seats',
                flows: [
                  [
                    named('picked', declaredTrigger(declaration, 'onPick')),
                    setState({ key: 'seat', type: 'text', value: '{{ picked.seat }}' })
                  ]
                ]
              }),
              button({
                content: 'Clear',
                flows: [[onClick(), declaredCallback(declaration, 'reset', { on: 'seats' })]]
              }),
              link({ href: 'mailto:hi@example.com', mode: 'external', children: [text('Write')] })
            ]
          },
          { id: 'about', name: 'About', slug: 'about', body: [] },
          { id: 'game', name: 'Game', slug: 'games/{{slug}}', body: [] }
        ]
      },
      { plugins: [declaration] }
    );

    expect(warnings).toEqual([]);
  });
});
