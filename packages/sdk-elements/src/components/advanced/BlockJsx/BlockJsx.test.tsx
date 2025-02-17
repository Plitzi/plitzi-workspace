import React from 'react';
import { render } from '@testing-library/react';

import BlockJsx from './BlockJsx';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('BlockJsx', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<BlockJsx />);

    expect(baseElement).toBeTruthy();
  });
});
