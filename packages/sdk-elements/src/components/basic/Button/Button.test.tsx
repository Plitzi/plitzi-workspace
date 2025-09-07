// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Button from './Button';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Button Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Button internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
