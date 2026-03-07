import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Text } from './Text';

describe('Text Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Text />);

    expect(baseElement).toBeTruthy();
  });
});
