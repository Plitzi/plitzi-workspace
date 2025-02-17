import React from 'react';
import { render } from '@testing-library/react';

import Text from './Text';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Text', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Text />);

    expect(baseElement).toBeTruthy();
  });
});
