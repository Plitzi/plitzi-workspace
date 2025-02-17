import React from 'react';
import { render } from '@testing-library/react';

import List from './List';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('List', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<List />);

    expect(baseElement).toBeTruthy();
  });
});
