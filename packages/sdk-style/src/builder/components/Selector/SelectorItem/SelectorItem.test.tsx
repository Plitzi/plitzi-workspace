import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SelectorItem from './SelectorItem';

describe('a class chip', () => {
  // The inspector showed a class the builder made as `container-2f16`, the element's id, which says nothing to a person.
  it('reads as its label, and edits its name: a rename is of the class, never of the label', () => {
    const onChange = vi.fn();
    render(<SelectorItem selector="container-2f16" label="Hero" type="class" onChange={onChange} />);

    const chip = screen.getByText('Hero');
    expect(chip.closest('[title]')?.getAttribute('title')).toBe('class: container-2f16');

    fireEvent.doubleClick(chip);
    expect(chip.textContent).toBe('container-2f16');

    chip.textContent = 'hero';
    fireEvent.blur(chip);

    expect(onChange).toHaveBeenCalledWith({ name: 'hero', type: 'class' });
    expect(chip.textContent).toBe('Hero');
  });

  it('reads as its name when it has no label', () => {
    render(<SelectorItem selector="lp-hero" type="class" />);

    expect(screen.getByText('lp-hero')).toBeTruthy();
  });
});
