// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Custom from './Custom';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Custom Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Custom internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
