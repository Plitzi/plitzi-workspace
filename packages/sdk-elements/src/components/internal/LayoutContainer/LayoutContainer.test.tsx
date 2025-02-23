// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Relatives
import LayoutContainer from './LayoutContainer';

describe('LayoutContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<LayoutContainer />);

    expect(baseElement).toBeTruthy();
  });
});
