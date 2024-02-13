// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import Container from './Container';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Container', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Container />);

    expect(baseElement).toBeTruthy();
  });
});
