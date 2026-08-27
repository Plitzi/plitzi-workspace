import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Workflow from './Workflow';

describe('Workflow', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Workflow nodes={{}} />);
    expect(baseElement).toBeTruthy();
  });
});
