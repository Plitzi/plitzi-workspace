import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ApiContainer } from './ApiContainer';

describe('ApiContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<ApiContainer />);

    expect(baseElement).toBeTruthy();
  });
});
