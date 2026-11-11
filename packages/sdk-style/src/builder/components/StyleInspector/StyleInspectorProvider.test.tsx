import { render } from '@testing-library/react';
import { use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { baseDefaultValue } from '@plitzi/sdk-shared/style';

import StyleInspectorContext from './StyleInspectorContext';
import StyleInspectorProvider from './StyleInspectorProvider';

import type { StyleInspectorContextValue } from './StyleInspectorContext';
import type { StyleInspectorProviderProps } from './StyleInspectorProvider';
import type { StyleCategory, StyleItem, StyleValue } from '@plitzi/sdk-shared';

/** What the element's bindings say for its style: a bound property is the binding's, never the inspector's. */
const binding = vi.hoisted(() => {
  const state: { data: Partial<Record<StyleCategory, StyleValue>> } = { data: {} };

  return state;
});

vi.mock('./hooks/useStyleBinding', () => ({ default: () => binding.data }));

const selector: StyleItem = {
  name: 'card',
  type: 'class',
  attributes: { base: { default: { color: 'red', 'padding-top': '4px' } } },
  cache: ''
};

let inspector: StyleInspectorContextValue | undefined;

const Probe = () => {
  inspector = use(StyleInspectorContext);

  return null;
};

const inspect = (props: Partial<StyleInspectorProviderProps> = {}) => {
  const onChange = vi.fn<NonNullable<StyleInspectorProviderProps['onChange']>>();
  render(
    <StoreProvider value={{ runtime: { sources: { variables: { brand: '#05f' } } } }}>
      <StyleInspectorProvider
        selector={selector}
        displayMode="desktop"
        inheritData={{ tree: [], style: {}, parentStyle: {} }}
        onChange={onChange}
        {...props}
      >
        <Probe />
      </StyleInspectorProvider>
    </StoreProvider>
  );
  if (!inspector) {
    throw new Error('The inspector’s context was not provided');
  }

  return { inspector, onChange };
};

beforeEach(() => {
  binding.data = {};
  inspector = undefined;
});

describe('StyleInspectorProvider', () => {
  it('reads the values of the selector it is on, and the space’s variables', () => {
    const { inspector } = inspect();

    expect(inspector.getValues()).toEqual({ color: 'red', 'padding-top': '4px' });
    expect(inspector.variables).toEqual({ brand: '#05f' });
    expect(inspector.styleSelector).toBe('base');
  });

  it('reads nothing for a selector it does not hold', () => {
    const { inspector } = inspect({ styleSelector: 'title' });

    expect(inspector.getValues()).toEqual({});
  });

  it('sets one property', () => {
    const { inspector, onChange } = inspect();
    inspector.setValue('color', 'blue');

    expect(onChange).toHaveBeenCalledWith('color', 'blue');
  });

  it('sets several over what the selector holds, a property left undefined taken out', () => {
    const { inspector, onChange } = inspect();
    inspector.setValue(undefined, { 'padding-top': undefined, 'margin-top': '8px' });

    expect(onChange).toHaveBeenCalledWith(undefined, { color: 'red', 'margin-top': '8px' });
  });

  it('leaves a bound property to its binding, alone or among others', () => {
    binding.data = { color: 'green' };
    const { inspector, onChange } = inspect();
    inspector.setValue('color', 'blue');

    expect(onChange).not.toHaveBeenCalled();

    inspector.setValue(undefined, { color: 'blue', 'margin-top': '8px' });

    expect(onChange).toHaveBeenCalledWith(undefined, { color: 'red', 'padding-top': '4px', 'margin-top': '8px' });
  });

  it('refuses a value of the wrong shape for what it names', () => {
    const { inspector, onChange } = inspect();
    // A whole block under one property, and a single value with none: neither is an edit the inspector makes.
    Reflect.apply(inspector.setValue, undefined, ['color', { color: 'blue' }]);
    Reflect.apply(inspector.setValue, undefined, [undefined, 'blue']);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('resets one property, or several at once', () => {
    const { inspector, onChange } = inspect();
    inspector.resetValue('color');

    expect(onChange).toHaveBeenLastCalledWith('color', undefined);

    inspector.resetValue(['color', 'padding-top']);

    expect(onChange).toHaveBeenLastCalledWith(undefined, {});
  });

  it('says the default of a property, of several, or of all', () => {
    const { inspector } = inspect();

    expect(inspector.getDefaultValue('display')).toBe(baseDefaultValue.display);
    expect(inspector.getDefaultValue(['display', 'position'])).toEqual({
      display: baseDefaultValue.display,
      position: baseDefaultValue.position
    });
    expect(inspector.getDefaultValue()).toBe(baseDefaultValue);
  });
});
