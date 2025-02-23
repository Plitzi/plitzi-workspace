// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Relatives
import Loading from './Loading';

describe('Loading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Loading />);

    expect(baseElement).toBeTruthy();
  });
});
