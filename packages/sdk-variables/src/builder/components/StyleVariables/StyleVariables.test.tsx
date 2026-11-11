import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import StyleVariables from './StyleVariables';

import type { StyleVariables as TStyleVariables } from '@plitzi/sdk-shared';

const VARIABLES: Partial<TStyleVariables> = {
  color: { brand: { light: '#0055ff', dark: '#88aaff', default: '#0055ff' } },
  spacing: { gap: '8px', gutter: '16px' },
  shadow: {}
};

/** A group opened, as a person opens it: its header clicked. */
const open = (category: string) => {
  fireEvent.click(screen.getByText(category));
};

describe('StyleVariables', () => {
  it('groups the variables by category, each saying how many it holds', () => {
    render(<StyleVariables variables={VARIABLES} />);

    expect(screen.getByText('color').parentElement?.textContent).toBe('color1');
    expect(screen.getByText('spacing').parentElement?.textContent).toBe('spacing2');
  });

  it('shows a group’s variables once it is opened, a colour by its schemes', () => {
    render(<StyleVariables variables={VARIABLES} />);
    open('color');

    expect(screen.getByTitle('brand')).not.toBeNull();
  });

  it('shows what it is given for none', () => {
    render(<StyleVariables variables={{ color: {}, spacing: {} }} empty={<p>No tokens yet</p>} />);

    expect(screen.getByText('No tokens yet')).not.toBeNull();
  });

  it('removes a variable by its category and name', () => {
    const onRemove = vi.fn();
    render(<StyleVariables variables={VARIABLES} onRemove={onRemove} />);
    open('spacing');
    fireEvent.click(screen.getAllByTitle('Remove')[0]);

    expect(onRemove).toHaveBeenCalledWith(StyleVariableCategory.SPACING, 'gap');
  });

  it('adds a spacing token only when it is a CSS length', async () => {
    const onAdd = vi.fn();
    const onAddingEnd = vi.fn();
    const { container } = render(
      <StyleVariables variables={VARIABLES} adding onAdd={onAdd} onAddingEnd={onAddingEnd} />
    );
    const select = container.querySelector('select');
    fireEvent.change(select ?? document.body, { target: { value: StyleVariableCategory.SPACING } });
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'section' } });
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: 'wide' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Value').getAttribute('aria-invalid')).toBe('true');
    });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: 'clamp(16px, 4vw, 48px)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({
        name: 'section',
        category: StyleVariableCategory.SPACING,
        value: 'clamp(16px, 4vw, 48px)'
      });
    });
    expect(onAddingEnd).toHaveBeenCalled();
  });

  it('edits a variable in place, its name kept', async () => {
    const onUpdate = vi.fn();
    render(<StyleVariables variables={VARIABLES} onUpdate={onUpdate} />);
    open('spacing');
    fireEvent.click(screen.getAllByTitle('Update')[0]);

    expect(screen.getByPlaceholderText<HTMLInputElement>('Name').disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '12px' } });
    const submit = screen
      .getAllByRole('button', { name: 'Update' })
      .find(button => button.getAttribute('type') === 'submit');
    fireEvent.click(submit ?? document.body);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({ name: 'gap', category: StyleVariableCategory.SPACING, value: '12px' });
    });
  });

  it('lets a new token go on Cancel', () => {
    const onAddingEnd = vi.fn();
    render(<StyleVariables adding onAddingEnd={onAddingEnd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAddingEnd).toHaveBeenCalledOnce();
  });
});
