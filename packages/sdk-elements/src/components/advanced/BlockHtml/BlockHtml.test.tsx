// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import BlockHtml from './BlockHtml';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('BlockHtml Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<BlockHtml internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
