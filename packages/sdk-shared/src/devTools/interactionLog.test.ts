import { describe, expect, it } from 'vitest';

import { isInteractionFlow } from './interactionLog';

import type { InteractionFlowParams, InteractionNoteParams } from '../types/DevToolsTypes';

const flow: InteractionFlowParams = {
  elementId: 'button-1',
  startTime: 10,
  endTime: 20,
  status: 'completed',
  node: { id: 'n1', title: 'On click' } as InteractionFlowParams['node'],
  nodes: {}
};

describe('telling the two kinds of interaction log apart', () => {
  it('reads a finished flow as one', () => {
    expect(isInteractionFlow(flow)).toBe(true);
  });

  /**
   * The one that mattered: an empty flow still has `nodes`, and the panel counts them. A guard written as
   * `Object.keys(nodes).length > 0` would send a real flow down the note path and lose its execution tree.
   */
  it('reads a flow that took no steps as a flow all the same', () => {
    expect(isInteractionFlow({ ...flow, nodes: {} })).toBe(true);
  });

  it.each<[string, InteractionNoteParams]>([
    ['a step wired to a name nobody registered', { node: undefined, available: ['onLoad'] }],
    ['a step that threw', { error: 'boom' }],
    ['a token that would not resolve', { param: 'url', value: '{{unresolved}}' }],
    ['a note with nothing on it at all', {}]
  ])('reads %s as a note', (_label, params) => {
    expect(isInteractionFlow(params)).toBe(false);
  });

  /**
   * A log written by an older build can carry `nodes: undefined` rather than omitting the key. `in` alone says
   * yes to that, and the panel then calls `Object.values(undefined)` — which is the crash this guard exists to
   * prevent, so the value is checked and not just the key.
   */
  it('reads an explicit undefined as a note, not as a flow with no steps', () => {
    expect(isInteractionFlow({ nodes: undefined } as unknown as InteractionNoteParams)).toBe(false);
  });
});
