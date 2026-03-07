import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { BlockHtml } from './BlockHtml';

describe('BlockHtml Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<BlockHtml />);

    expect(baseElement).toBeTruthy();
  });
});
