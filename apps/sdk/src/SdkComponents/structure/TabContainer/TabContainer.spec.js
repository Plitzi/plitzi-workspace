// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import TabContainer from './TabContainer';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('TabContainer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<TabContainer />);

    expect(baseElement).toBeTruthy();
  });
});
