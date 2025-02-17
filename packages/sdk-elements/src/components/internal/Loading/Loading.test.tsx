import React from 'react';
import { render } from '@testing-library/react';

import Loading from './Loading';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Loading', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Loading />);

    expect(baseElement).toBeTruthy();
  });
});
