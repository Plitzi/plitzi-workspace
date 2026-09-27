import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';

import useFocusWhenShown from './useFocusWhenShown';

const Field = ({ shown }: { shown: boolean }) => {
  const ref = useRef<HTMLInputElement>(null);
  useFocusWhenShown(ref, shown);

  return <input ref={ref} aria-label="field" />;
};

describe('useFocusWhenShown', () => {
  it('focuses the field as it mounts shown', () => {
    const { getByLabelText } = render(<Field shown />);

    expect(document.activeElement).toBe(getByLabelText('field'));
  });

  it('focuses it again each time it is shown, while it stays mounted', () => {
    const { getByLabelText, rerender } = render(<Field shown />);
    const field = getByLabelText('field');
    field.blur();

    rerender(<Field shown={false} />);
    expect(document.activeElement).not.toBe(field);

    rerender(<Field shown />);
    expect(document.activeElement).toBe(field);
  });

  it('leaves the focus alone while it is not shown', () => {
    const { getByLabelText } = render(<Field shown={false} />);

    expect(document.activeElement).not.toBe(getByLabelText('field'));
  });
});
