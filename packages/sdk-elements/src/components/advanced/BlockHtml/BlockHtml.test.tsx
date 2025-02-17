import React from 'react';
import { render } from '@testing-library/react';

import BlockHtml from './BlockHtml';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('BlockHtml', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<BlockHtml />);

    expect(baseElement).toBeTruthy();
  });
});
