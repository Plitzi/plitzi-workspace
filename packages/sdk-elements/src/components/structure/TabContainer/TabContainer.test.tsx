// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Relatives
import TabContainer from './TabContainer';

describe('TabContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<TabContainer />);

    expect(baseElement).toBeTruthy();
  });
});
