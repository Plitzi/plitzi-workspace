// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Image from './Image';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Image Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Image internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
