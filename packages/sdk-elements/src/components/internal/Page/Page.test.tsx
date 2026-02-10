// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Page } from './Page';

describe('Page Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Page />);

    expect(baseElement).toBeTruthy();
  });
});
