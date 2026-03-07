import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { BlockJsx } from './BlockJsx';

describe('BlockJsx Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<BlockJsx />);

    expect(baseElement).toBeTruthy();
  });
});
