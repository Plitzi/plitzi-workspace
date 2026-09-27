import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NodeWhileRunning from './NodeWhileRunning';

describe('NodeWhileRunning', () => {
  it('shows the mode the trigger has, and skip when it has none', () => {
    const queued = render(<NodeWhileRunning whileRunning="queue" />);
    expect(queued.getByText('Queue it: run after, in order')).toBeTruthy();
    queued.unmount();

    expect(render(<NodeWhileRunning />).getByText('Ignore the new one (no double submit)')).toBeTruthy();
  });
});
