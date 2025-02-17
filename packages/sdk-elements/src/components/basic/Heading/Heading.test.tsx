import React from 'react';
import { render } from '@testing-library/react';

import Heading from './Heading';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Heading', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Heading />);

    expect(baseElement).toBeTruthy();
  });
});
