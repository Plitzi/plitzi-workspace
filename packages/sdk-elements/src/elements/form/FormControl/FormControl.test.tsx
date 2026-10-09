import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import declaration from './declaration';
import { FormControl } from './FormControl';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

import type { FormControlProps } from './FormControl';

vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({
  default: () => ({ settings: { previewMode: true }, root: { baseElementId: 'root' } })
}));

vi.mock('@plitzi/sdk-interactions/InteractionsContext', async () => {
  const { createContext } = await import('react');

  return {
    default: createContext({ interactionsManager: { interactionTrigger: vi.fn() }, useInteractions: () => undefined })
  };
});

const STORE = { runtime: { sources: {} } };

const ENTRY = elementEntry('field', {
  definition: {
    rootId: 'root',
    label: 'field',
    type: 'formControl',
    styleSelectors: {
      base: '',
      label: 'f-label',
      requiredMark: 'f-required',
      input: 'f-box',
      field: 'f-field',
      icon: 'f-icon',
      error: 'f-error'
    }
  }
});

const renderControl = (subType: FormControlProps['subType']) =>
  render(
    <StoreProvider value={STORE}>
      <ElementContext value={ENTRY}>
        <FormControl
          ref={{ current: document.createElement('div') }}
          className=""
          subType={subType}
          name="secret"
          label="Secret"
          hideLabel={false}
          placeholder=""
          autoComplete={false}
          autoFocus={false}
          disabled={false}
          options={[{ label: 'One', value: '1' }]}
          required
          requiredMessage=""
          minLength={0}
          minLengthMessage=""
          maxLength={0}
          maxLengthMessage=""
          formatMessage=""
          pattern=""
          patternMessage=""
          matches=""
          matchesMessage=""
          readOnly={false}
          value=""
          error=""
        />
      </ElementContext>
    </StoreProvider>
  );

describe('FormControl slots', () => {
  it('reach the box, the field inside it, the show-password button and the required marker', () => {
    const { container } = renderControl('password');

    expect(container.querySelector('.form-control__input-container')?.classList.contains('f-box')).toBe(true);
    expect(container.querySelector('input')?.className).toBe('input-container__input f-field');
    expect(container.querySelector('button')?.className).toBe('form-input__icon f-icon');
    expect(container.querySelector('label')?.classList.contains('f-label')).toBe(true);
    expect(container.querySelector('.form-control__label--required')?.className).toBe(
      'form-control__label--required f-required'
    );
  });

  it('reach the select inside its box', () => {
    const { container } = renderControl('select');

    expect(container.querySelector('.form-control__select-container')?.classList.contains('f-box')).toBe(true);
    expect(container.querySelector('select')?.className).toBe('select-container__select f-field');
  });

  it('reach the required marker of a switch, whose input is its own box', () => {
    const { container } = renderControl('switch');

    expect(container.querySelector('input')?.className).toBe('form-control__switch-container f-box');
    expect(container.querySelector('.f-required')?.textContent).toBe('*');
  });
});

/** A box with a translucent background showed a second, darker box where the field sat: it painted the colour again. */
describe('FormControl field', () => {
  it('draws no background of its own: the box shows through it, whatever the box is painted', () => {
    const fields = Object.values(declaration.content.defaultStyle.subTypes).flatMap(variant =>
      'field' in variant.style && variant.style.field ? [variant.style.field.default['background-color']] : []
    );

    expect(fields.length).toBeGreaterThan(0);
    expect(new Set(fields)).toEqual(new Set(['transparent']));
  });
});

/** Required by default, an empty field nobody meant to require stopped the whole submit without a word. */
describe('FormControl required', () => {
  it('is optional unless it says so, as an HTML field is', () => {
    expect(declaration.content.attributes.required).toBe(false);
  });
});
