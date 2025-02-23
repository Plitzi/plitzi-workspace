// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Relatives
import Heading from './Heading';

describe('Heading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Heading />);

    expect(baseElement).toBeTruthy();
  });
});
