import { describe, it, expect } from 'vitest';

import { SpaceEvents, spaceEventSchemas, validateSpaceEvent } from './spaceEvents';

import type { Element } from '../types';

const element = { id: 'el1', attributes: {}, definition: { label: 'L', type: 'text', styleSelectors: {} } } as Element;

describe('the space event vocabulary', () => {
  it('names exactly the events it can validate — one list, not two', () => {
    expect(Object.keys(SpaceEvents)).toEqual(Object.keys(spaceEventSchemas));
    expect(Object.entries(SpaceEvents).every(([key, value]) => key === value)).toBe(true);
  });

  it('rejects an event nobody declared', () => {
    const result = validateSpaceEvent('SPACE_MADE_UP' as 'SPACE_UPDATE_ELEMENT', { element });

    expect(result.ok).toBe(false);
  });
});

describe('what a payload has to look like', () => {
  it('accepts what the mutation publishes', () => {
    expect(validateSpaceEvent('SPACE_UPDATE_ELEMENT', { element }).ok).toBe(true);
    expect(validateSpaceEvent('SPACE_REMOVE_PAGE', { pageId: 'p1' }).ok).toBe(true);
    expect(validateSpaceEvent('SPACE_UPDATE_SETTINGS', { path: 'a.b', value: 3 }).ok).toBe(true);
  });

  it('rejects a payload missing what the handler will read', () => {
    const result = validateSpaceEvent('SPACE_MOVE_ELEMENT', { from: 'a', to: 'b', elementId: 'el1' });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map(issue => issue.path)).toContain('dropPosition');
  });

  /**
   * The four mismatches the typed publisher found when the two vocabularies were merged. They are here so the shapes
   * stay pinned to what the server actually sends, rather than to what a payload type once claimed.
   */
  it('pins SPACE_UPDATED to a schema whose `flat` is a list, not the keyed map an MCP write holds', () => {
    expect(validateSpaceEvent('SPACE_UPDATED', { schema: { flat: [element], pages: ['el1'] } }).ok).toBe(true);
    expect(validateSpaceEvent('SPACE_UPDATED', { schema: { flat: { el1: element }, pages: ['el1'] } }).ok).toBe(false);
  });

  it('pins the template events to `style`, which is the field the publisher sends', () => {
    const template = { element, to: 'root', dropPosition: 'inside', style: { platform: {} } };

    expect(validateSpaceEvent('SPACE_ADD_TEMPLATE', template).ok).toBe(true);
    expect(validateSpaceEvent('SPACE_ADD_TEMPLATE', { ...template, style: undefined, styles: {} }).ok).toBe(false);
  });

  it('pins STYLE_UPDATED to the three parts a style edit publishes, not a whole Style', () => {
    expect(validateSpaceEvent('STYLE_UPDATED', { platform: {}, variables: {}, cache: '.a{}' }).ok).toBe(true);
    expect(validateSpaceEvent('STYLE_UPDATED', { platform: {}, variables: {} }).ok).toBe(false);
  });

  it('pins a segment variable removal to the name alone', () => {
    expect(validateSpaceEvent('SEGMENT_SPACE_REMOVE_VARIABLE', { contextId: 's1', variable: { name: 'x' } }).ok).toBe(
      true
    );
    expect(validateSpaceEvent('SEGMENT_SPACE_REMOVE_VARIABLE', { contextId: 's1', variable: {} }).ok).toBe(false);
  });
});
