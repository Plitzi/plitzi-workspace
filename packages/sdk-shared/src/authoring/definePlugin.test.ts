import { describe, expect, expectTypeOf, it } from 'vitest';

import { definePlugin } from './declare';

import type { ElementAttributesBrand } from './declare';

type JamAttributes = { bpm: number; kit: string; still: boolean };

describe('definePlugin', () => {
  it('writes the whole declaration a plugin used to spell out, from what only it can say', () => {
    const declaration = definePlugin<JamAttributes>()({
      type: 'jamDisc',
      label: 'Jam Disc',
      description: 'A kept loop drawn as a disc.',
      attributes: { bpm: 112, kit: 'nebula', still: false },
      triggers: { onPlay: { preview: { playing: '' } } },
      callbacks: { stop: {} }
    });

    expect(declaration).toEqual({
      type: 'jamDisc',
      triggers: {
        onPlay: { action: 'onPlay', title: 'On Play', type: 'trigger', params: {}, preview: { playing: '' } }
      },
      callbacks: { stop: { action: 'stop', title: 'Stop', type: 'callback', params: {} } },
      content: {
        attributes: { bpm: 112, kit: 'nebula', still: false },
        definition: {
          label: 'Jam Disc',
          type: 'jamDisc',
          description: 'A kept loop drawn as a disc.',
          items: [],
          bindings: {},
          styleSelectors: { base: '' },
          initialState: { visibility: true }
        },
        builder: {
          canDelete: true,
          canSelect: true,
          canDragDrop: true,
          canMove: true,
          canSnippet: true,
          itemsAllowed: [],
          itemsNotAllowed: []
        },
        market: {
          category: 'Jam Disc',
          owner: '',
          license: 'MIT',
          website: '',
          backgroundColor: '#4422ee',
          icon: ''
        },
        defaultStyle: {
          name: 'Jam Disc',
          displayMode: 'desktop',
          style: { base: { default: {} } },
          bindingsAllowed: {
            attributes: [
              { path: 'bpm', label: 'Bpm' },
              { path: 'kit', label: 'Kit' },
              { path: 'still', label: 'Still' }
            ],
            initialState: []
          }
        },
        settings: {}
      }
    });
  });

  it('takes what it is told over the defaults, and keeps an element’s other declarations', () => {
    const declaration = definePlugin<{ side: string }>()({
      type: 'dock',
      label: 'Dock',
      attributes: { side: 'left' },
      bindable: [],
      builder: { itemsAllowed: ['*'] },
      market: { owner: 'acme' },
      drawsNothing: true
    });

    expect(declaration.content.builder.itemsAllowed).toEqual(['*']);
    expect(declaration.content.market.owner).toBe('acme');
    expect(declaration.content.defaultStyle.bindingsAllowed.attributes).toEqual([]);
    expect(declaration.drawsNothing).toBe(true);
    expect(declaration.triggers).toEqual({});
  });

  it('carries its attributes and its events in its type, for the factory and the hook that read them', () => {
    const declaration = definePlugin<{ bpm?: number; pattern?: unknown[] }>()({
      type: 'jamDisc',
      label: 'Jam Disc',
      attributes: { bpm: 112, pattern: [] },
      triggers: { onPlay: { preview: { playing: '' } } }
    });

    expectTypeOf(declaration).toExtend<ElementAttributesBrand<{ bpm?: number; pattern?: unknown[] }>>();
    expectTypeOf(declaration.triggers.onPlay.preview).toEqualTypeOf<{ readonly playing: '' }>();
  });
});
