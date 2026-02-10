// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { NodeHtml } from './NodeHtml';

describe('NodeHtml Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<NodeHtml />);

    expect(baseElement).toBeTruthy();
  });
});
