import { describe, expect, it } from 'vitest';

import { saidFindings } from './workarounds';
import { experienceFrom, saidOfPlitzi } from '../report/experience';
import { findingsText } from '../report/reportHead';

import type { Finding } from './types';
import type { TaskRoundReport } from '../report/taskReports';

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
  it('puts what Plitzi got wrong first, then where agents went round it, then where it stood in the way, then the rest', () => {
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
      '#### Placed by no one — to triage (docs/en/improving-the-cli.md) (1)'
    ]);
    expect(lines).toContain('1. **2 command(s) crashed** · the platform · new');
  });
});

// Both sides of the line alike: whoever says a thing of Plitzi places it, and the report takes it as placed — what is
// the project's or the plan's is said with the round and never handed to Plitzi as work.
describe('what is said of Plitzi, placed by whoever said it', () => {
  const experience = experienceFrom(
    {
      ease: '3',
      hardest: 'the genre limit',
      plitziWrong: ['page check said runServerAction success while the server refused'],
      plitziNoWay: ['no way to read a state key between steps'],
      friction: ['the brief left controls.ts out of the task’s files']
    },
    'task complete'
  );

  it('keeps each with what it was, and what is no change of Plitzi’s as a friction alone', () => {
    expect(experience.plitzi).toEqual([
      { how: 'wrong', text: 'page check said runServerAction success while the server refused' },
      { how: 'no-way', text: 'no way to read a state key between steps' }
    ]);
    expect(experience.frictions).toEqual(['the brief left controls.ts out of the task’s files']);
  });

  it('reports each in its class, and no friction among Plitzi’s findings', () => {
    const round: TaskRoundReport = {
      version: 1,
      task: 't-genre-limit',
      round: 1,
      agent: 'dev-1',
      from: '2026-10-28T14:30:00.000Z',
      to: '2026-10-28T14:50:00.000Z',
      minutes: 20,
      sessions: [],
      checks: { run: 0, failed: 0, notOwn: 0, byStep: {}, why: [] },
      refusals: [],
      commands: { run: 0, failed: 0, chars: 0, seconds: 0, byName: {} },
      errors: [],
      explain: { asked: [], missed: [] },
      notices: [],
      experience
    };
    const said = saidOfPlitzi(
      [
        {
          at: '2026-10-28T14:40:00.000Z',
          by: 'test-1',
          text: 'run look answered 13k',
          about: 'plitzi',
          how: 'in-the-way'
        }
      ],
      [round]
    );
    const lines = findingsText(saidFindings(said), ['plitzi']);

    expect(lines.filter(line => line.startsWith('#### '))).toEqual([
      '#### Plitzi got it wrong — a bug, or what it said was not true (1)',
      '#### No way through Plitzi — the agents went round it (1)',
      '#### Plitzi in the way — refused what was meant, answered too long to act on (1)'
    ]);
    expect(lines.join('\n')).not.toContain('controls.ts');
  });
});
