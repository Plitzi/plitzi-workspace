import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import Typography from './Typography';
import StyleInspectorProvider from '../../StyleInspectorProvider';

import type { StyleObject } from '@plitzi/sdk-shared';

const typography = (rules: StyleObject, props: { isCollapsed?: boolean; onCollapse?: () => void } = {}) => {
  const onChange = vi.fn();
  render(
    <StoreProvider value={{ style: { fonts: [{ family: 'Inter', source: 'google', weights: [400, 700] }] } }}>
      <StyleInspectorProvider
        displayMode="desktop"
        selector={{ name: 'card', type: 'class', attributes: { base: { default: rules } }, cache: '' }}
        inheritData={{ tree: [], style: {}, parentStyle: {} }}
        onChange={onChange}
      >
        <Typography isCollapsed={false} {...props} />
      </StyleInspectorProvider>
    </StoreProvider>
  );

  return onChange;
};

/** The select of a row, found by its label: a row's title says whether it is set, its label what it is. */
const selectOf = (label: string): HTMLSelectElement => {
  const found = screen.getByText(label, { selector: 'label' }).parentElement?.parentElement?.querySelector('select');
  if (!found) {
    throw new Error(`No select in the row “${label}”`);
  }

  return found;
};

const weights = (select: HTMLSelectElement) =>
  Array.from(select.options)
    .filter(option => !option.disabled)
    .map(option => option.value);

describe('Typography', () => {
  it('offers only the weights the family the selector names was declared with', () => {
    typography({ 'font-family': 'Inter' });

    expect(weights(selectOf('Weight'))).toEqual(['400', '700']);
  });

  it('offers no weight for a family the space does not declare: nothing loads it', () => {
    typography({ 'font-family': 'Lobster' });

    expect(weights(selectOf('Weight'))).toEqual([]);
  });

  it('shows what the selector holds', () => {
    typography({ 'font-family': 'Inter', 'font-size': '18px' });

    expect(selectOf('Font').value).toBe('Inter');
    expect(screen.getByDisplayValue('18')).not.toBeNull();
  });

  it('writes each property it is given', () => {
    const onChange = typography({ 'font-family': 'Inter' });
    fireEvent.change(selectOf('Weight'), { target: { value: '700' } });
    fireEvent.click(screen.getByTitle('Center'));
    fireEvent.click(screen.getByTitle('Italic'));
    fireEvent.click(screen.getByTitle('All Caps'));

    expect(onChange).toHaveBeenCalledWith('font-weight', '700');
    expect(onChange).toHaveBeenCalledWith('text-align', 'center');
    expect(onChange).toHaveBeenCalledWith('font-style', 'italic');
    expect(onChange).toHaveBeenCalledWith('text-transform', 'uppercase');
  });

  it('says when it is opened, by its name', () => {
    const onCollapse = vi.fn();
    typography({}, { isCollapsed: true, onCollapse });
    fireEvent.click(screen.getByText('Typography'));

    expect(onCollapse).toHaveBeenCalledWith('typography', false);
  });
});
