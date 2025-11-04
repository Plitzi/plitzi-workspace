// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import NodeHtml from './NodeHtml';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('NodeHtml Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<NodeHtml internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
