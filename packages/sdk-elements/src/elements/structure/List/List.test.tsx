import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { List } from './List';

describe('List Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<List />);

    expect(baseElement).toBeTruthy();
  });
});
