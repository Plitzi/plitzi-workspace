import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Video } from './Video';

describe('Video Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Video />);

    expect(baseElement).toBeTruthy();
  });
});
