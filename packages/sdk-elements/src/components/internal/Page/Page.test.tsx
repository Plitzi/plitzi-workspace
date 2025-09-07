// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Page from './Page';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Page Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Page internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
