import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import StyleInspector from './StyleInspector';

import type { InspectorProps } from './Inspector';
import type { StyleInspectorProps } from './StyleInspector';
import type { SelectorProps } from '../Selector/Selector';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { Element, StyleItem } from '@plitzi/sdk-shared';

type Choice = Exclude<Option, OptionGroup>;

/** What the inspector below is aimed at: what this component decides, the categories being another's tests. */
const inspected = vi.hoisted(() => {
  const state: { props?: InspectorProps } = {};

  return state;
});

const selectorBar = vi.hoisted(() => {
  const state: { props?: SelectorProps } = {};

  return state;
});

const builder = vi.hoisted(() => ({ handler: vi.fn<(event: string, ...args: unknown[]) => void>() }));

vi.mock('./Inspector', () => ({
  default: (props: InspectorProps) => {
    inspected.props = props;

    return null;
  }
}));

vi.mock('../Selector', () => ({
  default: (props: SelectorProps) => {
    selectorBar.props = props;

    return null;
  }
}));

vi.mock('@plitzi/sdk-shared/builder/contexts', async () => {
  const { createContext } = await import('react');

  return { BuilderContext: createContext({ builderHandler: builder.handler }) };
});

/** A picker by its placeholder: pick an option, clear it, or take one away. */
vi.mock('@plitzi/plitzi-ui/Select2', () => ({
  default: ({
    placeholder,
    value,
    options = [],
    onChange,
    onRemove
  }: {
    placeholder: string;
    value?: string;
    options?: Choice[];
    onChange?: (option?: Choice) => void;
    onRemove?: (option: Choice) => void;
  }) =>
    createElement(
      'fieldset',
      { 'aria-label': placeholder, 'data-value': value ?? '' },
      ...options.map(option =>
        createElement(
          'button',
          { key: option.value, onClick: () => onChange?.(option) },
          `${placeholder}: ${option.value}`
        )
      ),
      createElement('button', { onClick: () => onChange?.(undefined) }, `Clear ${placeholder}`),
      createElement('input', {
        'aria-label': `New ${placeholder}`,
        onKeyDown: (event: { key: string; currentTarget: { value: string } }) => {
          if (event.key === 'Enter') {
            onChange?.({ label: event.currentTarget.value, value: event.currentTarget.value });
          }
        }
      }),
      ...options.map(option =>
        createElement(
          'button',
          { key: `x-${option.value}`, onClick: () => onRemove?.(option) },
          `Remove ${option.value}`
        )
      )
    )
}));

const item = (
  name: string,
  attributes: StyleItem['attributes'] = { base: { default: { color: 'red' } } }
): StyleItem => ({
  name,
  type: name === 'button' ? 'element' : 'class',
  attributes,
  cache: ''
});

const SELECTORS: Record<string, StyleItem> = {
  button: item('button'),
  primary: item('primary', {
    base: { default: { color: 'red' }, variants: { large: { default: { 'font-size': '20px' } } } }
  }),
  ghost: item('ghost')
};

const ELEMENT: Element = {
  id: 'el-1',
  attributes: {},
  definition: { label: 'Button', type: 'button', rootId: 'el-1', styleSelectors: { base: 'button primary' } }
};

const inspector = (props: Partial<StyleInspectorProps> = {}) => {
  const onChange = vi.fn();
  const view = render(
    <StoreProvider value={{ schema: { flat: { 'el-1': ELEMENT } }, style: { platform: {} } }}>
      <StyleInspector
        displayMode="desktop"
        selectors={SELECTORS}
        element={ELEMENT}
        styleSelectors={ELEMENT.definition.styleSelectors}
        onChange={onChange}
        {...props}
      />
    </StoreProvider>
  );

  return { onChange, ...view };
};

const target = () => {
  const { styleSelector, styleState, styleVariant, styleAncestor, stylePseudo, styleCondition } = inspected.props ?? {};

  return { styleSelector, styleState, styleVariant, styleAncestor, stylePseudo, styleCondition };
};

beforeEach(() => {
  inspected.props = undefined;
  selectorBar.props = undefined;
  builder.handler.mockReset();
  localStorage.clear();
});

describe('StyleInspector', () => {
  it('starts on an element’s last class, the element’s own rules and its classes beneath', () => {
    const { onChange } = inspector({ value: 'primary' });

    expect(onChange).toHaveBeenCalledWith('primary');
    expect(inspected.props?.selectors?.map(selector => selector.name)).toEqual(['button', 'primary']);
    expect(inspected.props?.selector?.name).toBe('primary');
    expect(target()).toMatchObject({ styleSelector: 'base', styleState: undefined, styleVariant: undefined });
  });

  it('adds a class the space has not got, to the selector the inspector is on', () => {
    inspector({ value: 'primary' });
    act(() => {
      selectorBar.props?.onAdd?.({ name: 'outline', type: 'class' }, false);
    });

    expect(builder.handler).toHaveBeenCalledWith(
      'styleAddSelector',
      'desktop',
      'outline',
      'class',
      undefined,
      undefined,
      {
        styleSelector: 'base',
        componentType: undefined
      }
    );

    builder.handler.mockClear();
    act(() => {
      selectorBar.props?.onAdd?.({ name: 'ghost', type: 'class' }, false);
    });

    expect(builder.handler).not.toHaveBeenCalled();
  });

  it('duplicates a class with its rules under a new name, and never over one that exists', () => {
    inspector({ value: 'primary' });
    act(() => {
      selectorBar.props?.onAdd?.({ name: 'primary-copy', type: 'class' }, true, { name: 'primary', type: 'class' });
      selectorBar.props?.onAdd?.({ name: 'ghost', type: 'class' }, true, { name: 'primary', type: 'class' });
      selectorBar.props?.onAdd?.({ name: 'other', type: 'class' }, true);
    });

    expect(builder.handler).toHaveBeenCalledOnce();
    expect(builder.handler).toHaveBeenCalledWith(
      'styleAddSelector',
      'desktop',
      'primary-copy',
      'class',
      undefined,
      { color: 'red' },
      { styleSelector: 'base', componentType: undefined }
    );
  });

  it('picks a class, and lets it go when the one picked is picked again', () => {
    const { onChange } = inspector({ value: 'primary' });
    onChange.mockClear();
    act(() => {
      selectorBar.props?.onSelectorSelected?.({ name: 'button', type: 'element' });
    });

    expect(onChange).toHaveBeenLastCalledWith('button');

    act(() => {
      selectorBar.props?.onSelectorSelected?.({ name: 'primary', type: 'class' });
    });

    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('writes an element’s classes and removes a class from the space', () => {
    inspector({ value: 'primary' });
    act(() => {
      selectorBar.props?.onChange?.('button ghost');
    });

    expect(builder.handler).toHaveBeenCalledWith('schemaUpdateElement', {
      ...ELEMENT,
      definition: { ...ELEMENT.definition, styleSelectors: { base: 'button ghost' } }
    });
    // The element handed over is a new one: the one the inspector was given is left as it was.
    expect(ELEMENT.definition.styleSelectors.base).toBe('button primary');

    act(() => {
      selectorBar.props?.onRemove?.({ name: 'ghost', type: 'class' });
    });

    expect(builder.handler).toHaveBeenLastCalledWith('styleRemoveSelector', 'desktop', 'ghost');
  });

  it('aims the inspector at a variant and a state, says so, and goes back to the plain rules', () => {
    inspector({ value: 'primary' });
    fireEvent.click(screen.getByText('Variant: large'));
    fireEvent.click(screen.getByText('State: hover'));

    expect(target()).toMatchObject({ styleVariant: 'large', styleState: 'hover' });

    fireEvent.click(screen.getByTitle("Back to the selector's own rules"));

    expect(target()).toMatchObject({ styleVariant: undefined, styleState: undefined });
  });

  it('removes a variant from the class, and stops editing it', () => {
    inspector({ value: 'primary' });
    fireEvent.click(screen.getByText('Variant: large'));
    fireEvent.click(screen.getByText('Remove large'));

    expect(builder.handler).toHaveBeenCalledWith('styleUpdateSelector', 'desktop', 'primary', undefined, undefined, {
      styleSelector: 'base',
      styleVariant: 'large',
      styleAncestor: undefined,
      componentType: undefined
    });
    expect(target().styleVariant).toBeUndefined();
  });

  it('folds the rarer targets away until asked for, and takes only a condition that is one', () => {
    inspector({ value: 'primary' });

    expect(screen.queryByLabelText('Condition')).toBeNull();

    fireEvent.click(screen.getByTitle('Target an ancestor, a pseudo-element or a condition'));
    fireEvent.click(screen.getByText('Variant: large'));
    const typed = screen.getByLabelText('New Condition');
    Object.assign(typed, { value: 'nonsense' });
    fireEvent.keyDown(typed, { key: 'Enter' });

    expect(target().styleCondition).toBeUndefined();

    Object.assign(typed, { value: 'container (max-width: 30rem)' });
    fireEvent.keyDown(typed, { key: 'Enter' });

    expect(target().styleCondition).toBe('container (max-width: 30rem)');
    // A condition holds the class's own rules, not a variant's.
    expect(target().styleVariant).toBeUndefined();
    expect(screen.getByTitle('An ancestor, pseudo-element or condition is in use')).not.toBeNull();
  });

  it('aims at a pseudo-element of the class', () => {
    inspector({ value: 'primary' });
    fireEvent.click(screen.getByTitle('Target an ancestor, a pseudo-element or a condition'));
    const [first] = screen.getAllByText(/^Pseudo-element: /);
    fireEvent.click(first);

    expect(target().stylePseudo).toBe(first.textContent.replace('Pseudo-element: ', ''));
  });

  it('offers no class bar in the style manager, and any other class as the ancestor', () => {
    inspector({ mode: 'manager', element: undefined, styleSelectors: undefined, value: 'primary' });

    expect(selectorBar.props).toBeUndefined();

    fireEvent.click(screen.getByTitle('Target an ancestor, a pseudo-element or a condition'));

    expect(screen.getByText(/: ghost$/)).not.toBeNull();
  });

  it('shows only the controls it is allowed', () => {
    inspector({ value: 'primary', allowStyleState: false, allowStyleVariant: false });

    expect(screen.queryByLabelText('Variant')).toBeNull();
    expect(screen.queryByLabelText('State')).toBeNull();
  });

  it('starts over on the base selector when another selector is picked from the element’s list', () => {
    inspector({
      value: 'primary',
      styleSelectorsAvailables: ['base', 'icon'],
      styleSelectors: { base: 'button primary', icon: 'ghost' }
    });
    fireEvent.click(screen.getByText('State: hover'));
    const select = screen.getByDisplayValue<HTMLSelectElement>('base');
    fireEvent.change(select, { target: { value: 'icon' } });

    expect(target()).toMatchObject({ styleSelector: 'icon', styleState: undefined });
  });
});
