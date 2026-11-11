import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SchemaVariables from './SchemaVariables';

import type { SchemaVariable } from '@plitzi/sdk-shared';

const VARIABLES: SchemaVariable[] = [
  { name: 'apiUrl', type: 'text', category: 'general', value: 'https://api.example.com', subValues: [] },
  {
    name: 'brand',
    type: 'color',
    category: 'theme',
    value: '#0055ff',
    subValues: [{ value: '#ff5500', when: { combinator: 'and', rules: [] } }]
  }
];

describe('SchemaVariables', () => {
  it('lists each variable by its name and value, marking one with variations', () => {
    const { container } = render(<SchemaVariables variables={VARIABLES} onRemove={vi.fn()} />);

    expect(screen.getByTitle('apiUrl')).not.toBeNull();
    expect(screen.getByText('https://api.example.com')).not.toBeNull();
    expect(container.querySelectorAll('[title="Has Variations"]')).toHaveLength(1);
  });

  it('shows what it is given for none, and not while a new one is being written', () => {
    const { rerender } = render(<SchemaVariables variables={[]} empty={<p>No variables yet</p>} />);

    expect(screen.getByText('No variables yet')).not.toBeNull();
    rerender(<SchemaVariables variables={[]} empty={<p>No variables yet</p>} adding />);
    expect(screen.queryByText('No variables yet')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add' })).not.toBeNull();
  });

  it('adds a new variable when its form is valid, then closes the form', async () => {
    const onAdd = vi.fn();
    const onAddingEnd = vi.fn();
    render(<SchemaVariables variables={[]} adding onAdd={onAdd} onAddingEnd={onAddingEnd} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'siteTitle' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'Plitzi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'siteTitle', value: 'Plitzi', type: 'text' }));
    });
    expect(onAddingEnd).toHaveBeenCalled();
  });

  it('refuses a name too short, and adds nothing', async () => {
    const onAdd = vi.fn();
    render(<SchemaVariables variables={[]} adding onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'Plitzi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('true');
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('lets a new variable go on Cancel', () => {
    const onAddingEnd = vi.fn();
    render(<SchemaVariables variables={[]} adding onAddingEnd={onAddingEnd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAddingEnd).toHaveBeenCalledOnce();
  });

  it('removes a variable by its name', () => {
    const onRemove = vi.fn();
    render(<SchemaVariables variables={VARIABLES} onRemove={onRemove} />);
    fireEvent.click(screen.getAllByTitle('Remove')[0]);

    expect(onRemove).toHaveBeenCalledWith('apiUrl');
  });

  it('edits a variable in place, its name kept, and says the new value', async () => {
    const onUpdate = vi.fn();
    render(<SchemaVariables variables={VARIABLES} onUpdate={onUpdate} onRemove={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Update')[0]);

    expect(screen.getByLabelText<HTMLInputElement>('Name').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'https://api.plitzi.test' } });
    const submit = screen
      .getAllByRole('button', { name: 'Update' })
      .find(button => button.getAttribute('type') === 'submit');
    expect(submit).toBeDefined();
    fireEvent.click(submit ?? document.body);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'apiUrl', value: 'https://api.plitzi.test' })
      );
    });
  });

  it('shows a variable’s details when it is selected', () => {
    render(<SchemaVariables variables={VARIABLES} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByTitle('brand'));

    expect(screen.getAllByText(/brand/).length).toBeGreaterThan(1);
  });
});
