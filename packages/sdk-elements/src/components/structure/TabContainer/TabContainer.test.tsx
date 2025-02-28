// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import TabContainer from './TabContainer';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('TabContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<TabContainer internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
