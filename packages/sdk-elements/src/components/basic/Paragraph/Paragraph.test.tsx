// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Relatives
import Paragraph from './Paragraph';

describe('Paragraph Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Paragraph />);

    expect(baseElement).toBeTruthy();
  });
});
