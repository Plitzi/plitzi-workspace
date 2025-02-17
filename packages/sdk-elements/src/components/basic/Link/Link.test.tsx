import React from 'react';
import { render } from '@testing-library/react';

import Link from './Link';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Link', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Link />);

    expect(baseElement).toBeTruthy();
  });
});
