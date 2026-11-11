import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import RawStyle from './RawStyle';
import StyleInspectorProvider from '../../StyleInspectorProvider';

import type { StyleItem } from '@plitzi/sdk-shared';
import type { ReactElement } from 'react';

vi.mock('@plitzi/plitzi-ui/CodeMirror', () => ({
  default: ({ value, readOnly }: { value: string; readOnly?: boolean }) =>
    createElement('textarea', { 'aria-label': 'CSS', value, readOnly, onChange: () => undefined })
}));

const selector = (name: string, color: string): StyleItem => ({
  name,
  type: 'class',
  attributes: { base: { default: { color } } },
  cache: ''
});

/** Inside the inspector, as the builder draws it: a category reads the selector's values for its dots. */
const inspected = (ui: ReactElement) =>
  render(
    <StoreProvider value={{}}>
      <StyleInspectorProvider displayMode="desktop" inheritData={{ tree: [], style: {}, parentStyle: {} }}>
        {ui}
      </StyleInspectorProvider>
    </StoreProvider>
  );

const css = () => screen.getByLabelText<HTMLTextAreaElement>('CSS');

describe('RawStyle', () => {
  it('shows the CSS the selectors compile to, read-only, one block after another', () => {
    inspected(<RawStyle selectors={[selector('card', 'red'), selector('title', 'blue')]} isCollapsed={false} />);

    expect(css().readOnly).toBe(true);
    expect(css().value).toMatch(/\.card[^}]*color:\s*red[\s\S]*\n\n[\s\S]*\.title[^}]*color:\s*blue/);
  });

  it('shows nothing for no selector', () => {
    inspected(<RawStyle isCollapsed={false} />);

    expect(css().value).toBe('');
  });

  it('says when it is folded or opened, by its name', () => {
    const onCollapse = vi.fn();
    inspected(<RawStyle selectors={[]} isCollapsed onCollapse={onCollapse} />);
    fireEvent.click(screen.getByText('Raw Style'));

    expect(onCollapse).toHaveBeenCalledWith('rawStyle', false);
  });
});
