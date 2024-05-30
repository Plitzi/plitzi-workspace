// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import Page from './Page';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Page />);

    expect(baseElement).toBeTruthy();
  });
});
