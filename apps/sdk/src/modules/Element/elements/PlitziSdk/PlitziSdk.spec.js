// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import PlitziSdk from './PlitziSdk';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('PlitziSdk', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<PlitziSdk />);

    expect(baseElement).toBeTruthy();
  });
});
