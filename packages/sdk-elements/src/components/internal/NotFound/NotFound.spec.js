// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import NotFound from './NotFound';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('NotFound', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<NotFound />);

    expect(baseElement).toBeTruthy();
  });
});
