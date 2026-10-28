import { describe, expect, it } from 'vitest';

import { commandNamed, weighedText, weightOf, withReach } from './weigh';
import { ranAs } from '../../tests/ranAs';

import type { Finding } from './types';
import type { UsageLine } from '../core/usage';

const use = (by: string, command: string, code = 0): UsageLine => ({
  at: '2026-10-28T10:00:00.000Z',
  by,
  command,
  ...ranAs(command),
  chars: 100,
  ms: 100,
  code
});

const finding = (title: string, more: Partial<Finding> = {}): Finding => ({
  kind: 'said',
  owner: 'plitzi',
  title,
  evidence: [],
  times: 1,
  subject: title,
  ...more
});

// Carlos: the findings read the same whether met once on a command run twice, or on the one every agent runs.
describe('how much a finding weighs', () => {
  it('names the command a finding is about — the one said first, the longest at one place', () => {
    const names = ['page', 'page check', 'page shot', 'page measure', 'task look'];

    expect(commandNamed(finding('page check /rooms --click explore-show-remind: could not be brought'), names)).toBe(
      'page check'
    );
    expect(commandNamed(finding('page shot has no --element; page measure takes the same names'), names)).toBe(
      'page shot'
    );
    expect(
      commandNamed(finding('Reviewing t-a: the guest view', { evidence: ['design-1 ran task look t-a /rooms'] }), names)
    ).toBe('task look');
    expect(commandNamed(finding('the lamp reads ON AIR'), names)).toBeUndefined();
  });

  it('says the reach of its command in the run — its calls, the agents calling it, the failed — and weighs by it', () => {
    const usage = [
      use('dev-1', 'plitzi page check /'),
      use('dev-2', 'plitzi page check /rooms', 1),
      use('test-1', 'plitzi page check /u/dax'),
      use('dev-1', 'plitzi task show t-a')
    ];
    const [check, show, none] = withReach(
      [
        finding('page check reads an sr-only line cut short', { times: 2, seenIn: ['r-1'] }),
        finding('task show left out the file holding the change'),
        finding('the lamp reads ON AIR')
      ],
      usage
    );

    expect(check.reach).toEqual({ command: 'page check', calls: 3, agents: 3, failed: 1 });
    expect(weightOf(check)).toBe(12);
    expect(weighedText(check)).toBe('weight 12 · 2 runs · page check: 3 calls by 3 agents, 1 failed');
    expect(weighedText(show)).toBe('weight 1 · 1 run · task show: 1 call by 1 agent');
    expect(none.reach).toBeUndefined();
    expect(weighedText(none)).toBe('weight 1 · 1 run');
  });
});
