// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import Custom from './Custom';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Custom', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Custom />);

    expect(baseElement).toBeTruthy();
  });
});
