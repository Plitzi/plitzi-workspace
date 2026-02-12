// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Link } from './Link';

describe('Link Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Link />);

    expect(baseElement).toBeTruthy();
  });
});
