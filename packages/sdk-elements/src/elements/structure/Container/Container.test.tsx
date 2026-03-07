import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Container } from './Container';

describe('Container Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Container />);

    expect(baseElement).toBeTruthy();
  });
});
