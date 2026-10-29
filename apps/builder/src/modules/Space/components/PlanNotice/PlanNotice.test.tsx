import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PlanNotice from './PlanNotice';

const { locked } = vi.hoisted(() => ({ locked: vi.fn() }));

vi.mock('../../hooks/useSpaceEntitlements', () => ({ default: () => ({ locked }) }));

// A panel says what the plan leaves out before anyone fills in a form the server refuses.
describe('PlanNotice', () => {
  it('names the plan that includes the panel’s capability, what happens meanwhile and the way there', () => {
    locked.mockReturnValue({
      included: false,
      label: 'Running space functions',
      requires: 'App',
      upgradeUrl: 'https://plitzi.test/pricing?space=4&plan=app'
    });

    render(<PlanNotice capability="functions" meanwhile="They do not run until then." />);

    expect(locked).toHaveBeenCalledWith('functions');
    expect(
      screen.getByText(/Running space functions is included in the App plan and above\. They do not run/)
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the plans' }).getAttribute('href')).toBe(
      'https://plitzi.test/pricing?space=4&plan=app'
    );
  });

  it('says nothing when the plan includes it', () => {
    locked.mockReturnValue(undefined);

    const { container } = render(<PlanNotice capability="functions" />);

    expect(container.textContent).toBe('');
  });
});
