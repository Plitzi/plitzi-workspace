// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Dropdown from './Dropdown';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Dropdown Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Dropdown internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
