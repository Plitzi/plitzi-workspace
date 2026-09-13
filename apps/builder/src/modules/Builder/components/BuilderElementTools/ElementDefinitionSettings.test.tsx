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

    expect(container.querySelectorAll('input')).toHaveLength(1);

    fireEvent.click(getByTitle('Label'));
    await flushStorageSync();

    expect(container.querySelectorAll('input')[1].value).toBe('Hero section');
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
