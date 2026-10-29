import { describe, expect, it } from 'vitest';

import { caughtBy, provedBy } from '.';

import type { AcceptanceResult } from '../core/model';

const result = (ok: boolean, output: string[] = []): AcceptanceResult => ({
  said: 'The panel lists the storms',
  check: 'npx playwright test visual/monitor.spec.ts',
  ok,
  output
});

// A tester read "the code before does not run (a file it added is still imported without it)" of a before whose
// webServer said `cannot bind port 55659: already in use`: the machine's at that moment, never the code's.
describe('a check whose server could not take its port', () => {
  const busy = [
    '[WebServer] [SSR] cannot bind port 55659: already in use',
    'Error: Process from config.webServer exited'
  ];

  it('proves nothing either way, and is said as the machine’s — before a task as on a mutant', () => {
    const line = { said: 'The panel lists the storms', check: 'npx playwright test visual/monitor.spec.ts' };

    expect(provedBy({ ...line, before: result(false, busy), after: result(true) })).toBe('unanswered');
    expect(
      provedBy({ ...line, before: result(false, ['Error: Process from config.webServer exited']), after: result(true) })
    ).toBe('broken');
    expect(caughtBy({ ...line, copy: result(true), mutant: result(false, busy) })).toBe('unanswered');
  });
});
