import { act, fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { elementIdConflict } from '@plitzi/sdk-schema/helpers/elementId';

import ElementDefinitionSettings from './ElementDefinitionSettings';

import type { Element } from '@plitzi/sdk-shared';

// The real conflict rules live in sdk-schema (`elementIdConflict`) and have their own tests; here the field is driven
// against a flat holding one element, so what is asserted is the wiring, not a re-statement of those rules.
const flat: Record<string, Element> = {
  'taken-name': {
    id: 'taken-name',
    attributes: {},
    definition: { rootId: 'page1', label: 'Other', type: 'text', items: [], styleSelectors: { base: '' } }
  }
};

const definition: Element['definition'] = {
  rootId: 'page1',
  label: 'Hero section',
  type: 'text',
  items: [],
  styleSelectors: { base: '' }
};

const getNameConflict = (id: string) => elementIdConflict(flat, id);

/**
 * Both toggles are `useStorage` values under one storage key, and under `NODE_ENV=test` it tells its other instances
 * about a write on a microtask. So mounting, and every toggle, schedules updates that land after the event that caused
 * them — they have to be flushed inside `act`, or React reports each one as unwrapped.
 */
const flushStorageSync = () =>
  act(async () => {
    await Promise.resolve();
  });

const renderSettings = async (id = 'hero') => {
  const onRename = vi.fn();
  const { container, getByText, getByTitle } = render(
    <ElementDefinitionSettings definition={definition} id={id} getNameConflict={getNameConflict} onRename={onRename} />
  );
  await flushStorageSync();

  // The name field is the first input; the label field only exists once its toggle is pressed.
  return { input: container.querySelectorAll('input')[0], onRename, getByText, getByTitle, container };
};

describe('ElementDefinitionSettings', () => {
  // `useStorage` persists the toggle in localStorage, so a test would otherwise inherit the previous one's panel.
  beforeEach(() => localStorage.clear());

  it('shows the element name as the one always-visible field', async () => {
    const { input } = await renderSettings();

    expect(input.value).toBe('hero');
  });

  it('keeps the free label text behind its toggle', async () => {
    const { container, getByTitle } = await renderSettings();
    const labelField = () => container.querySelector<HTMLInputElement>('input[placeholder="Hero section"]');

    expect(labelField()).toBeNull();

    fireEvent.click(getByTitle('Label'));
    await flushStorageSync();

    expect(labelField()?.value).toBe('Hero section');
  });

  it('does not rename when the field is only focused and left', async () => {
    const { input, onRename } = await renderSettings();

    fireEvent.blur(input);

    expect(onRename).not.toHaveBeenCalled();
  });

  it('renames on blur', async () => {
    const { input, onRename } = await renderSettings();

    fireEvent.change(input, { target: { value: 'products-api' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('products-api');
  });

  it('slugifies what a person types rather than refusing it — prose in, a key the document can hold out', async () => {
    const { input, onRename } = await renderSettings();

    fireEvent.change(input, { target: { value: 'Hero section' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('Hero-section');
  });

  it('rejects a name nothing usable survives, and reverts the field', async () => {
    const { input, onRename, getByText } = await renderSettings();

    fireEvent.change(input, { target: { value: '!!!' } });
    expect(getByText(/has to start with a letter/)).toBeTruthy();

    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('hero');
  });

  it('rejects a name another element already answers to', async () => {
    const { input, onRename, getByText } = await renderSettings();

    fireEvent.change(input, { target: { value: 'taken-name' } });
    expect(getByText(/already used/)).toBeTruthy();

    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
  });

  it('reverts an emptied field rather than leaving an element with no name', async () => {
    const { input, onRename } = await renderSettings();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('hero');
  });
});

describe('ElementDefinitionSettings / load strategy', () => {
  beforeEach(() => localStorage.clear());

  const container: Element['definition'] = { ...definition, type: 'modalContainer' };

  const renderStrategy = async (props: { canHoldItems: boolean; definition?: Element['definition'] }) => {
    const onUpdate = vi.fn();
    const view = render(
      <ElementDefinitionSettings
        definition={props.definition ?? container}
        canHoldItems={props.canHoldItems}
        declaredLoadStrategy="lazy"
        id="modal"
        getNameConflict={getNameConflict}
        onUpdate={onUpdate}
        onRename={vi.fn()}
      />
    );
    await flushStorageSync();

    // By its label: the panel has other selects too (the flag gate's).
    const field = view.queryByLabelText('Load content');

    return { ...view, onUpdate, select: field instanceof HTMLSelectElement ? field : null };
  };

  it('is offered only for a type that holds children', async () => {
    const { select } = await renderStrategy({ canHoldItems: false, definition });

    expect(select).toBeNull();
  });

  it('is not offered for a page, which is never hidden the way a modal is', async () => {
    const { select } = await renderStrategy({ canHoldItems: true, definition: { ...definition, type: 'page' } });

    expect(select).toBeNull();
  });

  it('defaults to what the type declares, and says so', async () => {
    const { select, getByText } = await renderStrategy({ canHoldItems: true });

    expect(select?.value).toBe('');
    expect(getByText('Default — Lazy')).toBeTruthy();
  });

  it('stores a chosen strategy, and removes it when set back to the default', async () => {
    const { select, onUpdate } = await renderStrategy({ canHoldItems: true });
    expect(select).not.toBeNull();

    fireEvent.change(select ?? document.body, { target: { value: 'visible' } });
    expect(onUpdate).toHaveBeenLastCalledWith('loadStrategy', 'visible', true);

    fireEvent.change(select ?? document.body, { target: { value: '' } });
    expect(onUpdate).toHaveBeenLastCalledWith('loadStrategy', undefined, true);
  });

  describe('feature flag', () => {
    const renderGate = async (flagNames: string[], flag?: Element['definition']['flag']) => {
      const onUpdate = vi.fn();
      const { container, queryByText } = render(
        <ElementDefinitionSettings
          definition={{ ...definition, ...(flag ? { flag } : {}) }}
          id="hero"
          flagNames={flagNames}
          getNameConflict={getNameConflict}
          onUpdate={onUpdate}
          onRename={vi.fn()}
        />
      );
      await flushStorageSync();
      const selects = [...container.querySelectorAll('select')];

      return { onUpdate, queryByText, gate: selects.find(select => select.querySelector('option[value="beta"]')) };
    };

    it('is not offered while the space declares no flag', async () => {
      const { gate, queryByText } = await renderGate([]);

      expect(gate).toBeUndefined();
      expect(queryByText('Always rendered')).toBeNull();
    });

    it('gates the element on a declared flag, and removes the gate', async () => {
      const { gate, onUpdate } = await renderGate(['beta']);

      fireEvent.change(gate ?? document.body, { target: { value: 'beta' } });
      expect(onUpdate).toHaveBeenLastCalledWith('flag', { name: 'beta', is: true }, true);

      fireEvent.change(gate ?? document.body, { target: { value: '' } });
      expect(onUpdate).toHaveBeenLastCalledWith('flag', undefined, true);
    });

    it('keeps showing a gate on a flag the space no longer declares, and says why it is gone', async () => {
      const { queryByText } = await renderGate([], { name: 'beta', is: true });

      expect(queryByText('The space does not declare this flag, so it reads as off.')).not.toBeNull();
    });
  });
});
