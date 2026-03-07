import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Heading } from './Heading';

describe('Heading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Heading />);

    expect(baseElement).toBeTruthy();
  });
});
