// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import ApiContainer from './ApiContainer';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('ApiContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<ApiContainer internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
