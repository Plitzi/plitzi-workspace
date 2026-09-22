import { describe, expect, it } from 'vitest';

import { actionName } from './triggers';

import type { ActionDocument, ElementInteraction } from '../types';

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: '',
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const document = (triggerTitle: string, kind = 'schedule'): ActionDocument => ({
  name: 'Nightly sweep',
  nodes: { start: node('start', { type: 'trigger', action: kind, title: triggerTitle }) }
});

describe('actionName', () => {
  it('reads the name an author gave the trigger step', () => {
    expect(actionName(document('Morning digest'))).toBe('Morning digest');
  });

  it('falls back to the document name when the trigger is untitled', () => {
    expect(actionName(document('  '))).toBe('Nightly sweep');
  });

  // The default a node gets before anybody names it. Read as a name, every page-rendered action was "render".
  it('does not take a title that only repeats the trigger kind for a name', () => {
    expect(actionName(document('schedule'))).toBe('Nightly sweep');
    expect(actionName(document('render', 'render'))).toBe('Nightly sweep');
  });
});
