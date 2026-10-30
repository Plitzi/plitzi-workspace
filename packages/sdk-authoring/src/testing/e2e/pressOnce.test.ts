import { describe, expect, it } from 'vitest';

import { pressOnce } from './page';

import type { E2ePage } from './page';

/** A page as far as waiting for it to be still asks of it. */
const page = { evaluate: () => Promise.resolve() } as unknown as E2ePage;

/** A press that times out the first time it is made, with the call log Playwright writes then. */
const timingOut = (log: string) => {
  const presses: number[] = [];
  const press = (): Promise<void> => {
    presses.push(presses.length + 1);

    return presses.length === 1
      ? Promise.reject(new Error(`locator.click: Timeout 3000ms exceeded.\n${log}`))
      : Promise.resolve();
  };

  return { presses, press };
};

// A run's toggles read as never pressed: the click went out, Playwright's wait for what it set off timed out on a busy
// page, and the press made again put the toggle back.
describe('a press that timed out', () => {
  it('is not made again once it was made', async () => {
    const { presses, press } = timingOut(
      '  - performing click action\n  - click action done\n  - waiting for scheduled navigations to finish'
    );
    await pressOnce(page, press);

    expect(presses).toEqual([1]);
  });

  it('is not made again on a control that is disabled: the page settling changes nothing', async () => {
    const { presses, press } = timingOut('  - element is not enabled');

    await expect(pressOnce(page, press)).rejects.toThrow(/Timeout/);
    expect(presses).toEqual([1]);
  });

  it('is made again when it never went out', async () => {
    const { presses, press } = timingOut(
      '  - waiting for element to be visible, enabled and stable\n  - scrolling into view if needed'
    );
    await pressOnce(page, press);

    expect(presses).toEqual([1, 2]);
  });
});
