import { describe, expect, it } from 'vitest';

import {
  authorSpace,
  button,
  container,
  custom,
  declaredCallback,
  declaredTrigger,
  defineElement,
  onClick,
  setState,
  singlePageSpace
} from '..';

import type { StepSpec } from '../schema';

/**
 * A plugin handed to `authorSpace` as its DECLARATION is held to it like a built-in element.
 *
 * With only a type name the linter waved a plugin through, and every mistake in how a space used it rendered as
 * nothing at all: a flow on an event it never fires, a button calling an action it does not answer, an attribute it
 * never reads. The declaration already says all three — the CLI writes one beside every component.
 */

const declaration = {
  type: 'seatPicker',
  triggers: {
    onPick: { action: 'onPick', title: 'On Pick', type: 'trigger', params: {}, preview: { seat: '' } }
  },
  callbacks: {
    reset: { action: 'reset', title: 'Reset', type: 'callback', params: {} }
  },
  content: {
    attributes: { rows: 10, selected: '' },
    definition: { label: 'Seat Picker' },
    defaultStyle: { bindingsAllowed: { attributes: [{ path: 'taken' }] } }
  }
} as const;

const seatPicker = defineElement<{ rows?: number; selected?: string; taken?: string[]; colour?: string }>(declaration);

const codes = (flows: StepSpec[][] = [], extra: Record<string, unknown> = {}, bind?: Record<string, string>) => {
  try {
    const { warnings } = authorSpace(
      singlePageSpace([
        container({
          children: [
            seatPicker({ id: 'seats', flows, ...extra, ...(bind ? { bind } : {}) }),
            button({
              id: 'clear',
              content: 'Clear',
              flows: [[onClick(), declaredCallback(declaration, 'reset', { on: 'seats' })]]
            })
          ]
        })
      ]),
      { plugins: [declaration] }
    );

    return { warnings: warnings.map(warning => warning.code), error: '' };
  } catch (error) {
    return { warnings: [], error: (error as Error).message };
  }
};

describe('authorSpace with plugins', () => {
  it('knows a declared plugin: no unknown type, and its declared triggers and callbacks pass', () => {
    const result = codes([[declaredTrigger(declaration, 'onPick')]]);

    expect(result.error).toBe('');
    expect(result.warnings).not.toContain('unknown-element-type');
  });

  it('refuses a flow on an event the plugin never fires', () => {
    expect(codes([[{ type: 'trigger', action: 'onPickk', params: {} }]]).error).toMatch(/onPickk.*never fires/);
  });

  it('refuses a step sent to an action the plugin does not answer', () => {
    const { error } = codes([
      [declaredTrigger(declaration, 'onPick'), { type: 'callback', action: 'resett', on: 'seats', params: {} }]
    ]);

    expect(error).toMatch(/resett.*never answers/);
  });

  it('refuses an attribute the plugin never reads, and takes the ones it binds', () => {
    expect(codes([], { colour: 'red' }).error).toMatch(/"colour", which a "seatPicker" never reads/);
    expect(codes([], {}, { taken: 'state.taken' }).error).toBe('');
  });

  it('checks nothing about attributes a declaration says nothing about', () => {
    const bare = { type: 'bareWidget', content: { definition: { label: 'Bare' } } };
    const widget = defineElement<{ anything?: string }>(bare);
    const { warnings } = authorSpace(singlePageSpace([widget({ anything: 'goes' })]), { plugins: [bare] });

    expect(warnings.map(warning => warning.code)).not.toContain('unknown-attribute');
  });

  it('builds steps from the declaration: title, preview, and the element they run on', () => {
    expect(declaredTrigger(declaration, 'onPick')).toEqual({
      type: 'trigger',
      action: 'onPick',
      title: 'On Pick',
      preview: { seat: '' },
      params: {}
    });
    expect(declaredCallback(declaration, 'reset', { on: 'seats', params: { all: true } })).toEqual({
      type: 'callback',
      action: 'reset',
      title: 'Reset',
      on: 'seats',
      params: { all: true }
    });
  });
});

/**
 * A component of the project's own is usually hosted by `custom({ renderType })` — what `plitzi create` and
 * `plitzi add plugin` set up. Its events are the component's, so a flow on one was refused as something a `custom`
 * "never fires", and the CLI's own template could not be used as it was written.
 */
describe('a component hosted by custom', () => {
  const hosted = (flows: StepSpec[][], plugins?: (typeof declaration)[], extra: Record<string, unknown> = {}) => {
    try {
      authorSpace(
        singlePageSpace([
          custom({ id: 'seats', renderType: 'seatPicker', flows, ...extra }),
          button({
            id: 'clear',
            content: 'Clear',
            flows: [[onClick(), declaredCallback(declaration, 'reset', { on: 'seats' })]]
          })
        ]),
        plugins ? { plugins } : {}
      );

      return '';
    } catch (error) {
      return (error as Error).message;
    }
  };
  const picked = [declaredTrigger(declaration, 'onPick'), setState({ key: 'seat', type: 'text', value: '{{ seat }}' })];

  it('accepts the events and actions of the component once it is declared', () => {
    expect(hosted([picked], [declaration])).toBe('');
  });

  it('holds the host to the declaration: an event it never fires, an attribute it never reads', () => {
    expect(hosted([[{ type: 'trigger', action: 'onPickk', params: {} }]], [declaration])).toMatch(/never fires/);
    expect(hosted([], [declaration], { colour: 'red' })).toMatch(/never reads/);
  });

  it('judges nothing it cannot know when the component was not declared', () => {
    expect(hosted([picked])).toBe('');
  });
});
