import { describe, expect, it } from 'vitest';

import { durationLabel, jobControlsOf, watchLabel } from './helpers';

import type { SpaceJob } from '@plitzi/sdk-shared';

const job = (over: Partial<SpaceJob>): SpaceJob => ({
  id: 'job:1',
  environment: 'main',
  kind: 'function',
  name: 'train',
  status: 'pending',
  attempts: 0,
  maxAttempts: 3,
  dueAt: 1,
  createdAt: 1,
  updatedAt: 1,
  ...over
});

describe('what can be done to a job', () => {
  it('follows the Queue: pause what moves, resume what is set aside, stop what is not done, rerun what is', () => {
    expect(jobControlsOf(job({ status: 'pending' }))).toEqual(['pause', 'cancel']);
    expect(jobControlsOf(job({ status: 'running', pauseRequested: true }))).toEqual(['cancel']);
    expect(jobControlsOf(job({ status: 'running', cancelRequested: true }))).toEqual(['pause']);
    expect(jobControlsOf(job({ status: 'paused' }))).toEqual(['resume', 'cancel']);
    expect(jobControlsOf(job({ status: 'dead' }))).toEqual(['retry']);
    expect(jobControlsOf(job({ status: 'succeeded' }))).toEqual(['retry']);
  });

  it('never pauses a run of an action: it has nothing to resume from', () => {
    expect(jobControlsOf(job({ kind: 'action', trigger: 'schedule', status: 'running' }))).toEqual(['cancel']);
  });
});

describe('the words the panel says it in', () => {
  it('says a length of time as a person would', () => {
    expect(durationLabel(45)).toBe('45 s');
    expect(durationLabel(20 * 60)).toBe('20 min');
    expect(durationLabel(3600)).toBe('1 h');
    expect(durationLabel(5400)).toBe('1 h 30 min');
  });

  it('says who may watch a job', () => {
    expect(watchLabel(undefined)).toBe('Only whoever started it');
    expect(watchLabel({ mode: 'session' })).toBe('Anyone signed in to the space');
    expect(watchLabel({ mode: 'role', permissions: ['spaceView', 'reports'] })).toBe(
      'Whoever holds spaceView, reports'
    );
  });
});
