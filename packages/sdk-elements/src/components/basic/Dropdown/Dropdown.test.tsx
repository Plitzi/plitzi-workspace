// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Relatives
import Dropdown from './Dropdown';

describe('Dropdown Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Dropdown />);

    expect(baseElement).toBeTruthy();
  });
});
