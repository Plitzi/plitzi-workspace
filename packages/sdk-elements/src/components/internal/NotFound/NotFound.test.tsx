// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import NotFound from './NotFound';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('NotFound Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<NotFound internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
