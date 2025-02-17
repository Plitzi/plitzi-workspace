import React from 'react';
import { render } from '@testing-library/react';

import FontAwesome from './FontAwesome';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('FontAwesome', () => {
  it('should render successfully', () => {
    const BaseElement = render(<FontAwesome internalProps={{}} />);

    expect(BaseElement).toBeTruthy();
  });
});
