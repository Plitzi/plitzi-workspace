// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Image } from './Image';

describe('Image Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Image />);

    expect(baseElement).toBeTruthy();
  });
});
