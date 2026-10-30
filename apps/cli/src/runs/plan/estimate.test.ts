import { describe, expect, it } from 'vitest';

import { estimate, withPace } from './estimate';

import type { RunTask } from '../core/model';

/** A task of this many minutes, waiting on none: what an estimate reads of one. */
const task = (id: string, estimateMinutes: number): RunTask => ({
  id,
  kind: 'work',
  title: id,
  files: [`src/${id}.ts`],
  dependsOn: [],
  priority: 'medium',
  estimateMinutes,
  acceptance: []
});

const paced = (wallMinutes: number) => ({
  paced: { from: 'machine' as const, wallMinutes, ratio: 0.4, runs: 4, tasks: 40 }
});

// A run the CLI estimated at 40-85 minutes at this machine's pace asked its person three times, as "more than 120".
describe('a run long by its estimate, and short at its project’s pace', () => {
  const tasks = [task('t-a', 180), task('t-b', 160)];

  it('asks no one when its pace keeps it under the line, and says both when it does not', () => {
    const raw = estimate(tasks, 2);
    expect(raw).toMatchObject({ wallMinutes: 180, needsConfirmation: true });

    const short = withPace(raw, 2, paced(72));
    expect(short).toMatchObject({ needsConfirmation: false, paced: { wallMinutes: 72 } });
    expect(short.why).toBeUndefined();

    expect(withPace(raw, 2, paced(150))).toMatchObject({
      needsConfirmation: true,
      why: "about 150 minutes at this project's pace (180 estimated) (more than 120)"
    });
    expect(withPace(raw, 2, {})).toBe(raw);
  });
});

// Carlos: a team has more kinds of agent now — scouts, designers, testers — and seven no longer needs the person.
describe('a run’s agents at once', () => {
  const short = [task('t-a', 10), task('t-b', 10)];

  it('asks the person above seven, and not at seven', () => {
    expect(estimate(short, 7)).toMatchObject({ needsConfirmation: false });
    expect(estimate(short, 8)).toMatchObject({
      needsConfirmation: true,
      why: 'up to 8 agents at once (more than 7)'
    });
  });
});
