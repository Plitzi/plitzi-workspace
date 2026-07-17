import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { idRefConflict } from '@plitzi/sdk-schema/helpers/idRef';

import ElementDefinitionSettings from './ElementDefinitionSettings';

import type { Element } from '@plitzi/sdk-shared';

// The real conflict rules live in sdk-schema (`idRefConflict`) and have their own tests; here the field is driven
// against a flat holding one element, so what is asserted is the wiring, not a re-statement of those rules.
const flat: Record<string, Element> = {
  other: {
    id: 'other',
    idRef: 'taken-ref',
    attributes: {},
    definition: { rootId: 'page1', label: 'Other', type: 'text', items: [], styleSelectors: { base: '' } }
  }
};

const definition: Element['definition'] = {
  rootId: 'page1',
  label: 'Hero',
  type: 'text',
  items: [],
  styleSelectors: { base: '' }
};

const renderRefField = (idRef: string | null | undefined) => {
  const onUpdateRef = vi.fn();
  const { container, getByText, getByTitle } = render(
    <ElementDefinitionSettings
      definition={definition}
      idRef={idRef}
      getIdRefConflict={ref => idRefConflict(flat, ref)}
      onUpdateRef={onUpdateRef}
    />
  );

  fireEvent.click(getByTitle('Reference'));

  // The label input comes first; the ref field is the one the toggle just revealed.
  const inputs = container.querySelectorAll('input');

  return { input: inputs[inputs.length - 1], onUpdateRef, getByText };
};

describe('ElementDefinitionSettings', () => {
  // `useStorage` persists the toggle in localStorage, so a test would otherwise inherit the previous one's panel.
  beforeEach(() => localStorage.clear());

  it('keeps the reference field hidden until its toggle is pressed', () => {
    const { container, getByTitle } = render(
      <ElementDefinitionSettings
        definition={definition}
        idRef="hero"
        getIdRefConflict={ref => idRefConflict(flat, ref)}
        onUpdateRef={vi.fn()}
      />
    );

    expect(container.querySelectorAll('input')).toHaveLength(1);

    fireEvent.click(getByTitle('Reference'));

    expect(container.querySelectorAll('input')).toHaveLength(2);
  });

  it('renders a controlled empty field for an element whose idRef is null (as GraphQL returns it)', () => {
    const { input } = renderRefField(null);

    expect(input.value).toBe('');
  });

  it('does not commit anything when the field is only focused and left', () => {
    const { input, onUpdateRef } = renderRefField(null);

    fireEvent.blur(input);

    expect(onUpdateRef).not.toHaveBeenCalled();
  });

  it('commits a valid new ref on blur', () => {
    const { input, onUpdateRef } = renderRefField(null);

    fireEvent.change(input, { target: { value: 'products-api' } });
    fireEvent.blur(input);

    expect(onUpdateRef).toHaveBeenCalledWith('products-api');
  });

  it('rejects a ref carrying a separator the source grammar uses, and reverts the field', () => {
    const { input, onUpdateRef, getByText } = renderRefField('hero');

    fireEvent.change(input, { target: { value: 'hero.cta' } });
    expect(getByText(/not a valid reference/)).toBeTruthy();

    fireEvent.blur(input);
    expect(onUpdateRef).not.toHaveBeenCalled();
    expect(input.value).toBe('hero');
  });

  it('rejects a ref another element already owns', () => {
    const { input, onUpdateRef, getByText } = renderRefField('hero');

    fireEvent.change(input, { target: { value: 'taken-ref' } });
    expect(getByText(/already used/)).toBeTruthy();

    fireEvent.blur(input);
    expect(onUpdateRef).not.toHaveBeenCalled();
  });

  it('commits an empty ref when the field is cleared, so the element stops publishing a source', () => {
    const { input, onUpdateRef } = renderRefField('hero');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onUpdateRef).toHaveBeenCalledWith('');
  });
});
