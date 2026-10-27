import { describe, expect, it } from 'vitest';

import { teamNotices } from './teamNotices';

import type { RunTask } from './model';
import type { Team } from './team';

const card = (id: string, dependsOn: string[] = []): RunTask => ({
  id,
  title: id,
  kind: 'work',
  files: [],
  dependsOn,
  priority: 'high',
  estimateMinutes: 10,
  acceptance: ['Its result is a task'],
  spike: `What ${id} finds out`
});

const team = (scouts: number): Team => ({
  version: 1,
  agents: [
    { name: 'dev', roles: ['developer'], count: 4 },
    ...(scouts > 0 ? [{ name: 'scout', roles: ['scout'], count: scouts }] : [])
  ]
});

// encore-14's two flaky specs, cards of their own, waited behind the scope for its one scout.
describe('research cards beside the scouts that find them out', () => {
  it('says when more are ready at once than scouts, and that more scouts are the person’s to allow', () => {
    const cards = [card('s-scope'), card('s-listen-gate'), card('s-shows-dismiss'), card('s-later', ['s-scope'])];

    // Nor are research cards counted as work for the developers: no "4 tasks for 5 agents".
    expect(teamNotices({ tasks: cards }, team(1))).toEqual([
      "3 research cards at once (s-scope, s-listen-gate, s-shows-dismiss) and 1 scout at most: they are found out one after another. More scouts are the person's to allow — ask them (plitzi run team set scout --roles scout --count 3, run in their terminal)"
    ]);
    expect(teamNotices({ tasks: cards }, team(3)).some(each => each.includes('research cards at once'))).toBe(false);
    expect(teamNotices({ tasks: [card('s-scope')] }, team(0)).some(each => each.includes('research cards'))).toBe(
      false
    );
  });
});

// encore-14's stage of one fix, stacked on a team at work, read "1 task for 7 agents — a smaller team does it for less".
describe('a stage stacked on a run at work', () => {
  it('says nothing of the team’s size: it was said at the open', () => {
    const fix: RunTask = { ...card('t-fix'), files: ['src/fix.ts'], spike: undefined };

    expect(teamNotices({ tasks: [fix] }, team(1)).some(each => each.includes('task for'))).toBe(true);
    expect(teamNotices({ tasks: [fix] }, team(1), 0, [], { stage: true })).toEqual([]);
  });
});
