// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import List from './List';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('List Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<List internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
