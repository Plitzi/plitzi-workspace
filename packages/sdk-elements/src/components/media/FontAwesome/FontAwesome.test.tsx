// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import FontAwesome from './FontAwesome';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('FontAwesome Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<FontAwesome internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
