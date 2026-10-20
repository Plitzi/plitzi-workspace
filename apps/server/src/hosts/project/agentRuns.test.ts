import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACTIVE_RUN_FILE } from '@plitzi/sdk-shared/project';

import { watchAgentRuns } from './agentRuns';

const roots: string[] = [];

const project = (): string => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'agent-runs-'));
  roots.push(root);

  return root;
};

const open = (root: string, runId: string): void => {
  mkdirSync(path.dirname(path.join(root, ACTIVE_RUN_FILE)), { recursive: true });
  writeFileSync(
    path.join(root, ACTIVE_RUN_FILE),
    JSON.stringify({ runId, since: '2026-10-20T00:00:00.000Z', by: 'lead' })
  );
};

afterEach(() => {
  vi.useRealTimers();
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});

describe('watchAgentRuns', () => {
  it('says an open run where the person looks — once — and points at the preview', () => {
    const root = project();
    open(root, 'v12');
    const said: string[] = [];
    vi.useFakeTimers();
    const stop = watchAgentRuns(root, { say: line => said.push(line), everyMs: 10 });
    vi.advanceTimersByTime(50);
    stop();

    expect(said).toHaveLength(1);
    expect(said[0]).toContain('agents are working run "v12"');
    expect(said[0]).toContain('npm run start:preview');
  });

  it('says a run opened while it serves, and its end', () => {
    const root = project();
    const said: string[] = [];
    vi.useFakeTimers();
    const stop = watchAgentRuns(root, { say: line => said.push(line), everyMs: 10 });
    expect(said).toEqual([]);

    open(root, 'v13');
    vi.advanceTimersByTime(10);
    rmSync(path.join(root, ACTIVE_RUN_FILE));
    vi.advanceTimersByTime(10);
    stop();

    expect(said).toEqual([expect.stringContaining('run "v13"'), expect.stringContaining('run "v13" is closed')]);
  });
});
