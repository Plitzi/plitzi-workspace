// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import Video from './Video';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Video', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Video />);

    expect(baseElement).toBeTruthy();
  });
});
