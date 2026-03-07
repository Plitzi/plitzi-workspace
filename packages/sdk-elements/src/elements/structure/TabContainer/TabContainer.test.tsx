import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { TabContainer } from './TabContainer';

describe('TabContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<TabContainer />);

    expect(baseElement).toBeTruthy();
  });
});
