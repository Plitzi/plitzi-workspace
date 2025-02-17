import React from 'react';
import { render } from '@testing-library/react';

import Image from './Image';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Image', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Image />);

    expect(baseElement).toBeTruthy();
  });
});
