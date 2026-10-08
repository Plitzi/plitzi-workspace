/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  authorSpace,
  button,
  channel,
  delay,
  list,
  listItem,
  named,
  on,
  onClick,
  onKey,
  publishOn,
  runServerAction,
  setState,
  text,
  when,
  whileRunning
} from './index';

import type { PluginDeclarationData, SpaceSpec } from './index';

/**
 * The recipes the skill hands an agent (`skills/plitzi-authoring/recipes/*.ts`), each a file a project could hold.
 *
 * They are what a less capable model copies without reading anything else, so each has to author on the first try,
 * with no warning. If this fails, fix the recipe in the same change: a recipe that no longer authors teaches something
 * that no longer works.
 */
const recipes = import.meta.glob<{ recipe: SpaceSpec; plugins?: readonly PluginDeclarationData[] }>(
  '../skills/plitzi-authoring/recipes/*.ts',
  { eager: true }
);

describe('the skill’s recipes', () => {
  // A recipe nobody can find is not one: each is a row of the recipes' index, by the intent it answers.
  it('are each listed in the index of recipes', () => {
    const index = readFileSync(new URL('../skills/plitzi-authoring/reference/recipes.md', import.meta.url), 'utf-8');
    const unlisted = Object.keys(recipes)
      .map(path => `../recipes/${path.split('/').pop() ?? path}`)
      .filter(file => !index.includes(`](${file})`));

    expect(unlisted).toEqual([]);
  });

  // Nor with a suggestion: an agent applies those too, and a recipe that draws one teaches what the next run undoes.
  it.each(Object.entries(recipes).map(([path, module]) => [path.split('/').pop() ?? path, module] as const))(
    '%s authors with no warning and nothing to suggest',
    (_name, { recipe, plugins }) => {
      const { warnings, suggestions } = authorSpace(recipe, { plugins });

      expect(warnings).toEqual([]);
      // But the page for an unknown address: a recipe shows one thing, and the space it goes into has its own.
      expect(
        suggestions
          .filter(suggestion => suggestion.code !== 'not-found-page')
          .map(suggestion => `${suggestion.code}: ${suggestion.message}`)
      ).toEqual([]);
    }
  );

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

  it('a trigger that queues its firings authors with no warning, and only a trigger takes it', () => {
    const { schema, warnings } = authorSpace({
      name: 'Queue',
      permanentUrl: 'queue',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [
            button({
              id: 'go',
              content: 'Go',
              flows: [
                [whileRunning('queue', onClick()), delay(1000), setState({ key: 'done', type: 'boolean', value: true })]
              ]
            })
          ]
        }
      ]
    });
    const trigger = Object.values(schema.flat.go.definition.interactions ?? {}).find(node => node.type === 'trigger');

    expect(warnings).toEqual([]);
    expect(trigger?.whileRunning).toBe('queue');
    expect(() => whileRunning('queue', delay(1000))).toThrow('wraps a flow');
  });

  it('writes a trigger that skips as one that says nothing: skipping is the default, with one way to say it', () => {
    const { schema } = authorSpace({
      name: 'Skip',
      permanentUrl: 'skip',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [button({ id: 'go', content: 'Go', flows: [[whileRunning('skip', onClick()), delay(1000)]] })]
        }
      ]
    });
    const trigger = Object.values(schema.flat.go.definition.interactions ?? {}).find(node => node.type === 'trigger');

    expect(trigger).toBeDefined();
    expect(trigger).not.toHaveProperty('whileRunning');
  });

  it('writes an element bound to nothing as one with no bindings: an empty list is no bindings, said one way', () => {
    const { schema } = authorSpace({
      name: 'Unbound',
      permanentUrl: 'unbound',
      pages: [
        { id: 'home', name: 'Home', slug: '', isDefault: true, body: [button({ id: 'go', content: 'Go', bind: [] })] }
      ]
    });

    expect(schema.flat.go.definition).not.toHaveProperty('bindings');
  });

  it('a realtime channel authors with no warning, and a channel nobody can use is refused where it is written', () => {
    const { schema, warnings } = authorSpace({
      name: 'Board',
      permanentUrl: 'board',
      channels: { 'board:{id}': { access: { mode: 'public' }, presence: true } },
      pages: [
        {
          id: 'board',
          name: 'Board',
          slug: 'b/{{id}}',
          isDefault: true,
          body: [
            channel({
              id: 'room',
              topic: 'board:{{ id }}',
              flows: [
                [
                  whileRunning('queue', named('heard', on('onMessage'))),
                  setState({ key: 'last', type: 'text', value: '{{ heard.type }}' })
                ]
              ],
              children: [text('', { bind: { content: 'room.members.length' } })]
            }),
            button({
              content: 'Wave',
              flows: [[onClick(), publishOn('room', 'wave', { from: '{{ state.name }}' }, { echo: true })]]
            })
          ]
        }
      ]
    });

    expect(warnings).toEqual([]);
    expect(schema.settings.channels?.['board:{id}'].presence).toBe(true);
    expect(() =>
      authorSpace({
        name: 'X',
        permanentUrl: 'x',
        channels: { 'board {id}': { access: { mode: 'public' } } },
        pages: []
      })
    ).toThrow('a pattern is letters, digits');
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
                listItem({
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
                            {
                              field: 'state.pendingDelete',
                              operator: '=',
                              value: 'list_rows.item.id',
                              isBinding: true
                            },
                            runServerAction({ actionId: 'row-delete', input: { id: '{{ list_rows.item.id }}' } })
                          )
                        ]
                      ]
                    })
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
