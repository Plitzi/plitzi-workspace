// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import Dropdown from './Dropdown';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Dropdown', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Dropdown />);

    expect(baseElement).toBeTruthy();
  });
});
