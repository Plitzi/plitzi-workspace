import React from 'react';
import { render } from '@testing-library/react';

import ApiContainer from './ApiContainer';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('ApiContainer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ApiContainer />);

    expect(baseElement).toBeTruthy();
  });
});
