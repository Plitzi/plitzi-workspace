import { act, render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Workflow from './Workflow';

describe('Workflow', () => {
  it('should render successfully', async () => {
    const { baseElement } = render(<Workflow nodes={{}} />);

    // The provider loads its data sources from an effect and stores them a tick later; that update belongs in `act`.
    await act(async () => {
      await Promise.resolve();
    });

    expect(baseElement).toBeTruthy();
  });
});
