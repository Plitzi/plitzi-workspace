import { describe, expect, it } from 'vitest';

import { findingsText } from '../report/reportHead';

import type { Finding } from './types';

const finding = (title: string, more: Partial<Finding> = {}): Finding => ({
  kind: 'said',
  owner: 'plitzi',
  title,
  evidence: [],
  times: 1,
  subject: title,
  ...more
});

// Carlos: a run's report read as twenty-three things to change, a refused flag beside a false success — each is taken
// up its own way, and what an agent said is triaged before anything changes.
describe('Plitzi’s findings, by how each is taken up', () => {
  it('puts what Plitzi got wrong first, then where agents went round it, then where it stood in the way, then what was said', () => {
    const lines = findingsText(
      [
        finding('page check listed 3 of 2 rows'),
        finding('Refused as written ×3', { kind: 'refused-as-written' }),
        finding('Scripts written beside the CLI: 2', { kind: 'scratch-script' }),
        finding('2 command(s) crashed', { kind: 'crashed', area: 'platform' })
      ],
      ['plitzi']
    );

    expect(lines.filter(line => line.startsWith('#### '))).toEqual([
      '#### Plitzi got it wrong — a bug, or what it said was not true (1)',
      '#### No way through Plitzi — the agents went round it (1)',
      '#### Plitzi in the way — refused what was meant, answered too long to act on (1)',
      '#### Said by the agents and the lead — to triage (docs/en/improving-the-cli.md) (1)'
    ]);
    expect(lines).toContain('1. **2 command(s) crashed** · the platform · new');
  });
});
