import React from 'react';
import { render } from '@testing-library/react';

import Paragraph from './Paragraph';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Paragraph', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Paragraph />);

    expect(baseElement).toBeTruthy();
  });
});
