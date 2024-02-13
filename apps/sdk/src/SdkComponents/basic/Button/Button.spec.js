// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import Button from './Button';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('Button', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Button />);

    expect(baseElement).toBeTruthy();
  });
});
