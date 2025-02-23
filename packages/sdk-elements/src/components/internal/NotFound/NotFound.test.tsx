// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Relatives
import NotFound from './NotFound';

describe('NotFound Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<NotFound />);

    expect(baseElement).toBeTruthy();
  });
});
