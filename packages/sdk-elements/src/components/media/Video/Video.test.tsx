// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Video from './Video';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Video Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Video internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
