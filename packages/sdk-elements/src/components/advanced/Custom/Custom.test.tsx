// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Custom } from './Custom';

describe('Custom Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Custom />);

    expect(baseElement).toBeTruthy();
  });
});
