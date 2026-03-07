import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Button } from './Button';

describe('Button Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Button />);

    expect(baseElement).toBeTruthy();
  });
});
