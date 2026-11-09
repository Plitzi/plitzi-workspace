import { describe, expect, it, vi } from 'vitest';

import { createActionsModule } from '../module';
import { buildEntry, lookups, request } from './tests/runAction';

import type { ActionRunError } from './errors';

/**
 * A plan's allowance of runs for the period is a paywall: past it, no run of the space starts — refused before any step
 * runs, as `quota`, the refusal naming the plan that has more. A page's render is its page view's, never asked.
 */
describe('a run past its plan’s allowance for the period', () => {
  it('is refused before any step runs, as the limit it is', async () => {
    const admitRun = vi.fn(() => Promise.resolve('This space ran its 300,000 actions this month: App+ runs 750,000'));
    const { runAction } = createActionsModule({ lookups, admitRun });

    const refused = await runAction(request(buildEntry())).catch((error: unknown) => error as ActionRunError);

    expect(refused).toMatchObject({ reason: 'quota', limit: 'quota' });
    expect((refused as ActionRunError).message).toContain('App+ runs 750,000');
    expect(admitRun).toHaveBeenCalledWith(1);
  });

  it('never asks for a page’s render, which its page view pays for', async () => {
    const admitRun = vi.fn(() => Promise.resolve('spent'));
    const { runAction } = createActionsModule({ lookups, admitRun });

    await runAction({ ...request(buildEntry()), trigger: 'render' }).catch(() => undefined);

    expect(admitRun).not.toHaveBeenCalled();
  });
});
