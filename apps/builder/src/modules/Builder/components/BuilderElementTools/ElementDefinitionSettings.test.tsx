import { fireEvent, render } from '@testing-library/react';
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

const renderSettings = (id = 'hero') => {
  const onRename = vi.fn();
  const { container, getByText, getByTitle } = render(
    <ElementDefinitionSettings definition={definition} id={id} getNameConflict={getNameConflict} onRename={onRename} />
  );

  // The name field is the first input; the label field only exists once its toggle is pressed.
  return { input: container.querySelectorAll('input')[0], onRename, getByText, getByTitle, container };
};

describe('ElementDefinitionSettings', () => {
  // `useStorage` persists the toggle in localStorage, so a test would otherwise inherit the previous one's panel.
  beforeEach(() => localStorage.clear());

  it('shows the element name as the one always-visible field', () => {
    const { input } = renderSettings();

    expect(input.value).toBe('hero');
  });

  it('keeps the free label text behind its toggle', () => {
    const { container, getByTitle } = renderSettings();

    expect(container.querySelectorAll('input')).toHaveLength(1);

    fireEvent.click(getByTitle('Label'));

    expect(container.querySelectorAll('input')[1].value).toBe('Hero section');
  });

  it('does not rename when the field is only focused and left', () => {
    const { input, onRename } = renderSettings();

    fireEvent.blur(input);

    expect(onRename).not.toHaveBeenCalled();
  });

  it('renames on blur', () => {
    const { input, onRename } = renderSettings();

    fireEvent.change(input, { target: { value: 'products-api' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('products-api');
  });

  it('slugifies what a person types rather than refusing it — prose in, a key the document can hold out', () => {
    const { input, onRename } = renderSettings();

    fireEvent.change(input, { target: { value: 'Hero section' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('Hero-section');
  });

  it('rejects a name nothing usable survives, and reverts the field', () => {
    const { input, onRename, getByText } = renderSettings();

    fireEvent.change(input, { target: { value: '!!!' } });
    expect(getByText(/has to start with a letter/)).toBeTruthy();

    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('hero');
  });

  it('rejects a name another element already answers to', () => {
    const { input, onRename, getByText } = renderSettings();

    fireEvent.change(input, { target: { value: 'taken-name' } });
    expect(getByText(/already used/)).toBeTruthy();

    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
  });

  it('reverts an emptied field rather than leaving an element with no name', () => {
    const { input, onRename } = renderSettings();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('hero');
  });
});
