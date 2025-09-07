// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Container from './Container';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Container Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Container internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
