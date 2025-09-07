// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import LayoutContainer from './LayoutContainer';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('LayoutContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<LayoutContainer internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
