// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Text from './Text';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Text Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Text internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
