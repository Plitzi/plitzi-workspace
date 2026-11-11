import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import ManagerSelector from './ManagerSelector';

import type { ManagerSelectorProps } from './ManagerSelector';
import type { Element, StyleItem } from '@plitzi/sdk-shared';

const builder = vi.hoisted(() => ({ handler: vi.fn<(event: string, ...args: unknown[]) => void>() }));

vi.mock('@plitzi/sdk-shared/builder/contexts', async () => {
  const { createContext } = await import('react');

  return { BuilderContext: createContext({ builderHandler: builder.handler }) };
});

vi.mock('@plitzi/sdk-shared/elements', async () => {
  const { createContext } = await import('react');

  return { ComponentContext: createContext({ components: { current: {} } }) };
});

const item = (
  name: string,
  type: StyleItem['type'] = 'class',
  attributes: StyleItem['attributes'] = {}
): StyleItem => ({
  name,
  type,
  attributes,
  cache: ''
});

const element = (id: string, styleSelectors: Element['definition']['styleSelectors']): Element => ({
  id,
  attributes: {},
  definition: { label: id, type: 'box', rootId: 'root', parentId: 'root', styleSelectors }
});

const SELECTORS: Record<string, StyleItem> = {
  primary: item('primary'),
  card: item('card', 'class', { base: { ancestors: { dark: { default: { color: 'white' } } } } }),
  box: item('box', 'element'),
  ghost: item('ghost')
};

const HERO = element('hero', { base: 'card primary' });
const LINK = element('link', { base: 'primary' });
const FLAT_LIST = [HERO, LINK];

const manager = (props: Partial<ManagerSelectorProps> = {}) =>
  render(
    <StoreProvider value={{ style: { platform: { desktop: SELECTORS, tablet: {}, mobile: {} } } }}>
      <ManagerSelector
        displayMode="desktop"
        selectors={SELECTORS}
        flat={{ hero: HERO, link: LINK }}
        flatList={FLAT_LIST}
        {...props}
      />
    </StoreProvider>
  );

/** A selector's row, by the title its name carries: `class: card`, `element: box`. */
const rowOf = (name: string): HTMLElement => {
  const row = screen.getByTitle(new RegExp(`^\\w+: ${name}$`)).closest<HTMLElement>('.group');
  if (!row) {
    throw new Error(`No row for “${name}”`);
  }

  return row;
};

const names = () => screen.getAllByTitle(/^\w+: /).map(tag => tag.textContent);

/** The count of elements a row shows: its last figure, after the ancestors' badge (which says what it counts). */
const dressed = (name: string): string | undefined =>
  within(rowOf(name))
    .queryAllByText(/^\d+$/)
    .find(figure => !figure.closest('[title^="Rules under"]'))?.textContent;

const deleteRow = (name: string) => {
  fireEvent.click(within(rowOf(name)).getByRole('button'));
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
};

beforeEach(() => {
  builder.handler.mockReset();
});

describe('ManagerSelector', () => {
  it('lists the elements’ selectors first, then the classes, each by name', () => {
    manager();

    expect(names()).toEqual(['box', 'card', 'ghost', 'primary']);
  });

  it('counts the elements each selector dresses', () => {
    manager();

    expect(dressed('primary')).toBe('2');
    expect(dressed('card')).toBe('1');
    expect(dressed('ghost')).toBeUndefined();
  });

  it('narrows the list to what is searched', () => {
    manager();
    fireEvent.change(screen.getByPlaceholderText('Search Selector'), { target: { value: 'PRI' } });

    expect(names()).toEqual(['primary']);
  });

  it('picks a selector, and lets it go when picked again', () => {
    let picked: StyleItem | undefined;
    const onSelect = vi.fn((next: StyleItem | undefined | ((state?: StyleItem) => StyleItem | undefined)) => {
      picked = typeof next === 'function' ? next(picked) : next;
    });
    manager({ onSelect });
    fireEvent.click(rowOf('ghost'));

    expect(picked?.name).toBe('ghost');

    fireEvent.click(rowOf('ghost'));

    expect(picked).toBeUndefined();
  });

  it('takes a deleted class out of every element that wears it, the rest of its classes kept', () => {
    manager();
    deleteRow('primary');

    expect(builder.handler).toHaveBeenCalledWith('schemaUpdateElements', [
      element('hero', { base: 'card' }),
      element('link', { base: '' })
    ]);
    expect(builder.handler).toHaveBeenLastCalledWith('styleRemoveSelectors', 'desktop', ['primary']);
  });

  it('touches no element when the class deleted dresses none', () => {
    manager();
    deleteRow('ghost');

    expect(builder.handler).toHaveBeenCalledOnce();
    expect(builder.handler).toHaveBeenCalledWith('styleRemoveSelectors', 'desktop', ['ghost']);
  });

  it('deletes nothing when the removal is cancelled', () => {
    manager();
    fireEvent.click(within(rowOf('ghost')).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(builder.handler).not.toHaveBeenCalled();
  });

  it('deletes the selectors checked, all at once', () => {
    manager();
    fireEvent.click(within(rowOf('ghost')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('card')).getByRole('checkbox'));

    expect(screen.getByText('2 selected')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('Do you want to remove these 2 items ?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(builder.handler).toHaveBeenCalledWith('schemaUpdateElements', [element('hero', { base: 'primary' })]);
    expect(builder.handler).toHaveBeenLastCalledWith('styleRemoveSelectors', 'desktop', ['ghost', 'card']);
    expect(screen.queryByText('2 selected')).toBeNull();
  });

  it('says how many ancestor rules dress nothing, and cleans them up', () => {
    manager();

    expect(screen.getByText('1 unused ancestor rule')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clean up' }));

    expect(builder.handler).toHaveBeenCalledWith('styleUpdateSelector', 'desktop', 'card', undefined, undefined, {
      styleSelector: 'base',
      styleAncestor: 'dark',
      componentType: undefined
    });
  });
});
