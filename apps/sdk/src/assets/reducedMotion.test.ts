import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sheet = readFileSync(path.join(import.meta.dirname, 'plitzi-sdk.scss'), 'utf-8');

// A run's `addNotification` step ran and nothing showed: under reduced motion every animation was cut to 0.01ms, a
// toast's progress bar among them — and a toast closes when that bar's animation ends.
describe('the stills a visitor who asked for less motion gets', () => {
  it('cut every animation but a toast’s timer, which closes it', () => {
    const mixin = /@mixin reduced-motion\([^)]*\) \{[\s\S]*?\n\}/.exec(sheet)?.[0] ?? '';

    expect(mixin).toContain('animation-duration: 0.01ms !important');
    expect(mixin).toContain('*:not(.Toastify__progress-bar)');
  });
});
