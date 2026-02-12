// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { FontAwesome } from './FontAwesome';

describe('FontAwesome Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<FontAwesome />);

    expect(baseElement).toBeTruthy();
  });
});
