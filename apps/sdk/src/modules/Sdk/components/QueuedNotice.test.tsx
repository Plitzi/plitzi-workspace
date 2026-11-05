import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { clearActionRuns, recordActionRun, updateActionRun } from '@plitzi/sdk-shared/store';

import QueuedNotice from './QueuedNotice';

afterEach(() => {
  clearActionRuns();
});

describe('QueuedNotice', () => {
  it('says nothing while no call waits, and says so calmly while one does', () => {
    const { container } = render(<QueuedNotice />);
    expect(container.textContent).toBe('');

    let run = '';
    act(() => {
      run = recordActionRun({ actionId: 'book', mode: 'await', input: {} });
    });
    act(() => {
      updateActionRun(run, { status: 'queued' });
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Your request is waiting for the server — it will finish on its own.'
    );

    act(() => {
      updateActionRun(run, { status: 'completed', endedAt: Date.now() });
    });
    expect(container.textContent).toBe('');
  });
});
