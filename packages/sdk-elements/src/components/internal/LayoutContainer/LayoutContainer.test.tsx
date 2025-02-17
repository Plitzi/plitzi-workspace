import React from 'react';
import { render } from '@testing-library/react';

import LayoutContainer from './LayoutContainer';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('LayoutContainer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<LayoutContainer />);

    expect(baseElement).toBeTruthy();
  });
});
