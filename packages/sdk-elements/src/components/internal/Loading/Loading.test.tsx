// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Loading from './Loading';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Loading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Loading internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
