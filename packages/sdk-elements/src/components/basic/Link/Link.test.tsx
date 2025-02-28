// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Link from './Link';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Link Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Link internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
