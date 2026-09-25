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
  delay,
  form,
  formControl,
  link,
  list,
  modalContainer,
  named,
  onClick,
  onKey,
  onSubmit,
  openModal,
  runServerAction,
  setState,
  text,
  when
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

  /** `docs/en/authoring-spaces.md`, "What a step reads": a flow that waits, then reads the page as it is by then. */
  it('a keyboard shortcut authors with no warning, and one that cannot fire is refused where it is written', () => {
    const { warnings } = authorSpace({
      name: 'Keys',
      permanentUrl: 'keys',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [
            text('', { bind: { content: 'state.zoom' } }),
            button({
              content: 'Zoom',
              flows: [
                [onKey('plus, ='), setState({ key: 'zoom', type: 'text', value: 'in' })],
                [
                  named('pressed', onKey('mod+k, escape')),
                  setState({ key: 'last', type: 'text', value: '{{ pressed.key }}' })
                ]
              ]
            })
          ]
        }
      ]
    });

    expect(warnings).toEqual([]);
    expect(() => onKey('ctrl+shift')).toThrow("onKey('ctrl+shift') is not a shortcut");
    expect(() => onKey('arrowupp')).toThrow('not a key');
  });

  it('the undo window in the docs authors with no warning', () => {
    const { warnings } = authorSpace({
      name: 'Undo',
      permanentUrl: 'undo',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [
            list({
              id: 'rows',
              source: 'controlled',
              bind: { items: 'state.rows' },
              children: [
                button({
                  id: 'delete',
                  content: 'Delete',
                  flows: [
                    [
                      onClick(),
                      setState({ key: 'pendingDelete', type: 'text', value: '{{ list_rows.item.id }}' }),
                      delay(5000),
                      when(
                        { field: 'state.pendingDelete', operator: '=', value: 'list_rows.item.id', isBinding: true },
                        runServerAction({ actionId: 'row-delete', input: { id: '{{ list_rows.item.id }}' } })
                      )
                    ]
                  ]
                })
              ]
            }),
            button({
              content: 'Undo',
              flows: [[onClick(), setState({ key: 'pendingDelete', type: 'text', value: '' })]]
            })
          ]
        }
      ]
    });

    expect(warnings).toEqual([]);
  });
});
