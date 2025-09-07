// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import BlockJsx from './BlockJsx';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('BlockJsx Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<BlockJsx internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
