import { fireEvent, render, screen } from '@testing-library/react';
import { createElement, use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import Inspector from './Inspector';
import StyleInspectorContext from './StyleInspectorContext';

import type { InspectorProps } from './Inspector';
import type { InheritData } from '../../../helpers';
import type { Element, StyleItem } from '@plitzi/sdk-shared';

type CategoryProps = {
  isCollapsed?: boolean;
  replaceTokens?: boolean;
  onCollapse?: (id: string, collapsed: boolean) => void;
};

/**
 * Each category as its name, how it is folded and a button that writes one property through the inspector: what is
 * under test is which categories the inspector shows and where an edit goes, the categories being their own tests.
 */
const category = vi.hoisted(() => (id: string) => {
  const Category = ({ isCollapsed, replaceTokens, onCollapse }: CategoryProps) => {
    const { setValue } = use(StyleInspectorContext);

    return createElement(
      'section',
      { 'aria-label': id, 'data-collapsed': String(isCollapsed), 'data-tokens': String(replaceTokens) },
      createElement('button', { onClick: () => onCollapse?.(id, !isCollapsed) }, `fold ${id}`),
      createElement('button', { onClick: () => setValue('color', 'blue') }, `edit ${id}`)
    );
  };

  return { default: Category };
});

vi.mock('./categories/Background', () => category('background'));
vi.mock('./categories/Border', () => category('border'));
vi.mock('./categories/Display', () => category('display'));
vi.mock('./categories/DisplayFlexChild', () => category('displayFlexChild'));
vi.mock('./categories/Effects', () => category('effects'));
vi.mock('./categories/List', () => category('list'));
vi.mock('./categories/ListItem', () => category('listItem'));
vi.mock('./categories/Others', () => category('others'));
vi.mock('./categories/Position', () => category('position'));
vi.mock('./categories/RawStyle', () => category('rawStyle'));
vi.mock('./categories/Size', () => category('size'));
vi.mock('./categories/Spacing', () => category('spacing'));
vi.mock('./categories/Typography', () => category('typography'));
vi.mock('./categories/Variables', () => category('variables'));

const inherit = vi.hoisted(() => {
  const state: { data: InheritData } = { data: { tree: [], style: {}, parentStyle: {} } };

  return state;
});

vi.mock('./hooks/useStyleInherit', () => ({ default: () => inherit.data }));

const builder = vi.hoisted(() => ({ handler: vi.fn<(event: string, ...args: unknown[]) => void>() }));

vi.mock('@plitzi/sdk-shared/builder/contexts', async () => {
  const { createContext } = await import('react');

  return { BuilderContext: createContext({ builderHandler: builder.handler }) };
});

const element = (type: string, base = ''): Element => ({
  id: 'el-1',
  attributes: {},
  definition: { label: type, type, rootId: 'el-1', styleSelectors: { base } }
});

const SELECTOR: StyleItem = { name: 'card', type: 'class', attributes: {}, cache: '' };

const inspector = (props: Partial<InspectorProps> = {}) =>
  render(
    <StoreProvider value={{}}>
      <Inspector displayMode="desktop" element={element('box')} componentType="box" {...props} />
    </StoreProvider>
  );

const shown = () => screen.queryAllByRole('region').map(section => section.getAttribute('aria-label'));

const EVERY = [
  'list',
  'listItem',
  'display',
  'displayFlexChild',
  'spacing',
  'size',
  'position',
  'typography',
  'background',
  'border',
  'effects',
  'others',
  'variables',
  'rawStyle'
];

const COMMON = EVERY.filter(id => !['list', 'listItem', 'displayFlexChild'].includes(id));

beforeEach(() => {
  inherit.data = { tree: [], style: {}, parentStyle: {} };
  builder.handler.mockReset();
  localStorage.clear();
});

describe('Inspector', () => {
  it('shows an element the categories it uses, each folded', () => {
    inspector();

    expect(shown()).toEqual(COMMON);
    expect(screen.getAllByRole('region').every(section => section.dataset.collapsed === 'true')).toBe(true);
  });

  it('adds a list’s categories to a list, and a flex child’s to a child of a flex box', () => {
    const { unmount } = inspector({ element: element('list') });

    expect(shown()).toContain('list');
    expect(shown()).toContain('listItem');

    unmount();
    inherit.data = { tree: [], style: {}, parentStyle: { display: 'flex' } };
    inspector();

    expect(shown()).toContain('displayFlexChild');
    expect(shown()).not.toContain('list');
  });

  it('shows every category under All options, and always in the style manager', () => {
    const { unmount } = inspector();
    fireEvent.click(screen.getByLabelText('All options'));

    expect(shown()).toEqual(EVERY);

    unmount();
    localStorage.clear();
    inspector({ mode: 'manager', element: undefined });

    expect(shown()).toEqual(EVERY);
    expect(screen.queryByLabelText('All options')).toBeNull();
  });

  it('remembers what was opened, and folds everything at once', () => {
    inspector();
    fireEvent.click(screen.getByText('fold spacing'));

    expect(screen.getByRole('region', { name: 'spacing' }).dataset.collapsed).toBe('false');

    fireEvent.click(screen.getByTitle('Collapse every category'));

    expect(screen.getByRole('region', { name: 'spacing' }).dataset.collapsed).toBe('true');
  });

  it('narrows to the categories a search finds, opened, and says when none has it', () => {
    inspector();
    const search = screen.getByLabelText('Find a style property');
    fireEvent.change(search, { target: { value: 'typography' } });

    expect(shown()).toEqual(['typography']);
    expect(screen.getByRole('region', { name: 'typography' }).dataset.collapsed).toBe('false');

    fireEvent.change(search, { target: { value: 'zzzz' } });

    expect(shown()).toEqual([]);
    expect(screen.getByText(/No property here matches “zzzz”/).textContent).toContain('All options');
  });

  it('hands the categories the token switch', () => {
    inspector();
    fireEvent.click(screen.getByLabelText('Token values'));

    expect(screen.getByRole('region', { name: 'display' }).dataset.tokens).toBe('true');
  });

  it('writes an edit to the selector it is on, aimed where the inspector is', () => {
    inspector({ selector: SELECTOR, styleState: 'hover', styleVariant: 'large' });
    fireEvent.click(screen.getByText('edit display'));

    expect(builder.handler).toHaveBeenCalledWith('styleUpdateSelector', 'desktop', 'card', 'color', 'blue', {
      componentType: undefined,
      styleSelector: 'base',
      styleState: 'hover',
      styleVariant: 'large',
      styleAncestor: undefined,
      stylePseudo: undefined,
      styleCondition: undefined
    });
  });

  it('names the component of an element’s own selector', () => {
    inspector({ selector: { ...SELECTOR, name: 'box', type: 'element' } });
    fireEvent.click(screen.getByText('edit display'));

    expect(builder.handler).toHaveBeenCalledWith(
      'styleUpdateSelector',
      'desktop',
      'box',
      'color',
      'blue',
      expect.objectContaining({ componentType: 'box' })
    );
  });

  it('makes a class for an element with none, and adds it to the element’s classes', () => {
    inspector({ element: element('box', 'card') });
    fireEvent.click(screen.getByText('edit display'));
    const [[addEvent, , name, type, key, value], [updateEvent, updated]] = builder.handler.mock.calls;

    expect([addEvent, type, key, value]).toEqual(['styleAddSelector', 'class', 'color', 'blue']);
    expect(updateEvent).toBe('schemaUpdateElement');
    expect(updated).toMatchObject({ definition: { styleSelectors: { base: `card ${String(name)}` } } });
  });

  it('writes nothing with neither a selector nor a component to make one for', () => {
    inspector({ componentType: undefined });
    fireEvent.click(screen.getByText('edit display'));

    expect(builder.handler).not.toHaveBeenCalled();
  });
});
