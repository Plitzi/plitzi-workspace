// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Heading from './Heading';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Heading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Heading internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
