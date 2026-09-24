import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterEach, describe, expect, it } from 'vitest';

import type { ChildProcess } from 'node:child_process';

/**
 * The workers, for real: a server started in its own process with `workers`, driven over HTTP, and watched from the
 * outside — which process answered, what survives a killed worker, what a stop does to a request in flight.
 */

const FIXTURE = path.join(import.meta.dirname, 'fixtures/fleetServer.ts');
const SERVER_ROOT = path.resolve(import.meta.dirname, '../../../..');

type Started = { child: ChildProcess; port: number; output: () => string; exited: Promise<number | null> };

const started: Started[] = [];

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))
      );
    });
  });

/** One request on a connection of its own, so the primary hands each to whichever worker is next. */
const get = (port: number, requestPath = '/'): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: requestPath, agent: false }, res => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    // A connection handed to a worker in the instant it died is never answered: give up on it rather than hang.
    req.setTimeout(5_000, () => req.destroy(new Error(`no answer on ${requestPath}`)));
    req.on('error', reject);
  });

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const start = async (env: Record<string, string>, port?: number): Promise<Started> => {
  const chosen = port ?? (await freePort());
  let output = '';
  // Its own process group, so a failing test can still take every worker down with the primary.
  const child = spawn(process.execPath, ['--import', 'tsx', FIXTURE], {
    cwd: SERVER_ROOT,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(chosen), ...env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
  const run: Started = { child, port: chosen, output: () => output, exited };
  started.push(run);

  return run;
};

const untilServing = async (run: Started, timeoutMs = 30_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (run.child.exitCode !== null) {
      throw new Error(`the server exited (${run.child.exitCode}):\n${run.output()}`);
    }

    try {
      await get(run.port);

      return;
    } catch {
      await sleep(100);
    }
  }

  throw new Error(`the server did not answer within ${timeoutMs}ms:\n${run.output()}`);
};

/** Which processes answer: as many connections as it takes to see `expected` of them, or a bounded number. */
const servingPids = async (port: number, expected: number): Promise<Set<number>> => {
  const pids = new Set<number>();
  for (let attempt = 0; attempt < expected * 20 && pids.size < expected; attempt += 1) {
    pids.add(Number((await get(port)).body));
  }

  return pids;
};

const fail = (what: string, value: unknown): never => {
  throw new Error(`expected ${what}, got ${JSON.stringify(value)}`);
};

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : fail('a number', value));
const asBoolean = (value: unknown): boolean => (typeof value === 'boolean' ? value : fail('a boolean', value));
const asStrings = (value: unknown): string[] => {
  const strings = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

  return Array.isArray(value) && strings.length === value.length ? strings : fail('a list of strings', value);
};

const asVerdict = (value: unknown): { allowed: boolean } =>
  typeof value === 'object' && value !== null && 'allowed' in value && typeof value.allowed === 'boolean'
    ? { allowed: value.allowed }
    : fail('a rate-limit verdict', value);

/** A `/fleet/*` route: which process answered, and what — read with `read`, which refuses anything else. */
const fleet = async <T>(
  port: number,
  route: string,
  read: (value: unknown) => T
): Promise<{ pid: number; value: T }> => {
  const { body } = await get(port, `/fleet/${route}`);
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== 'object' || parsed === null || !('pid' in parsed) || typeof parsed.pid !== 'number') {
    return fail('a fleet answer', body);
  }

  return { pid: parsed.pid, value: read('value' in parsed ? parsed.value : undefined) };
};

/** Asks until every one of `expected` processes has answered once, and keeps each one's answer. */
const fromEach = async <T>(
  port: number,
  route: string,
  expected: number,
  read: (value: unknown) => T
): Promise<Map<number, T>> => {
  const answers = new Map<number, T>();
  for (let attempt = 0; attempt < expected * 30 && answers.size < expected; attempt += 1) {
    const { pid, value } = await fleet(port, route, read);
    answers.set(pid, value);
  }

  return answers;
};

type Role = { jobs: boolean; scheduling: boolean };

const asRole = (value: unknown): Role =>
  typeof value === 'object' &&
  value !== null &&
  'jobs' in value &&
  typeof value.jobs === 'boolean' &&
  'scheduling' in value &&
  typeof value.scheduling === 'boolean'
    ? { jobs: value.jobs, scheduling: value.scheduling }
    : fail('a role', value);

/** The role of every worker, once the one that runs the jobs has had time to start its scheduler. */
const rolesOf = async (port: number, expected: number): Promise<Map<number, Role>> => {
  const deadline = Date.now() + 10_000;
  let roles = await fromEach(port, 'role', expected, asRole);
  while (Date.now() < deadline && ![...roles.values()].some(role => role.scheduling)) {
    await sleep(100);
    roles = await fromEach(port, 'role', expected, asRole);
  }

  return roles;
};

afterEach(() => {
  for (const run of started.splice(0)) {
    if (run.child.pid !== undefined && run.child.exitCode === null) {
      try {
        process.kill(-run.child.pid, 'SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }
});

describe('workers — a server on several processes', () => {
  it('spreads connections across its workers, and the primary serves none of them', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);

    const pids = await servingPids(run.port, 3);

    expect(pids.size).toBe(3);
    expect(pids.has(run.child.pid ?? -1)).toBe(false);
  }, 60_000);

  it('serves from its own process with one worker', async () => {
    const run = await start({ WORKERS: '1' });
    await untilServing(run);

    expect(Number((await get(run.port)).body)).toBe(run.child.pid);
  }, 60_000);

  it('replaces a worker that dies while serving, and keeps answering', async () => {
    const run = await start({ WORKERS: '2' });
    await untilServing(run);
    const [victim] = await servingPids(run.port, 2);

    process.kill(victim, 'SIGKILL');
    const deadline = Date.now() + 30_000;
    let pids = new Set<number>();
    while (Date.now() < deadline) {
      try {
        pids = await servingPids(run.port, 2);
        if (pids.size === 2 && !pids.has(victim)) {
          break;
        }
      } catch {
        // A connection the dead worker held.
      }

      await sleep(200);
    }

    expect(pids.size).toBe(2);
    expect(pids.has(victim)).toBe(false);
    expect(run.child.exitCode).toBeNull();
    expect(run.output()).toMatch(/stopped \(signal SIGKILL\); starting another/);
  }, 90_000);

  it('finishes a request in flight before it stops, and leaves no worker behind', async () => {
    const run = await start({ WORKERS: '2' });
    await untilServing(run);
    const workers = await servingPids(run.port, 2);

    const inFlight = get(run.port, '/slow');
    await sleep(200);
    run.child.kill('SIGTERM');

    await expect(inFlight).resolves.toMatchObject({ status: 200 });
    expect(await run.exited).toBe(0);
    await sleep(200);
    expect([...workers].filter(isAlive)).toEqual([]);
  }, 60_000);

  it('stops, rather than restarting forever, when its workers cannot start', async () => {
    const port = await freePort();
    const holder = net.createServer();
    await new Promise<void>(resolve => holder.listen(port, '127.0.0.1', resolve));

    try {
      const run = await start({ WORKERS: '2' }, port);
      const code = await Promise.race([run.exited, sleep(30_000).then(() => 'still running')]);

      expect(code).toBe(1);
      expect(run.output()).toMatch(/stopped before it could serve/);
    } finally {
      holder.close();
    }
  }, 60_000);

  it('builds a plugin once, before its workers start, rather than once in each', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'workers-plugin-'));
    const plugin = path.join(dir, 'Probe.tsx');
    writeFileSync(plugin, 'export default function Probe() { return <div>probe</div>; }\n');

    try {
      const run = await start({ WORKERS: '3', PLUGIN_FILE: plugin, PLUGINS_DIR: path.join(dir, 'built') });
      await untilServing(run);
      await servingPids(run.port, 3);

      expect(run.output().match(/Plugin "probe@[^"]*" building/g) ?? []).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('runs the scheduler and the jobs in one worker only', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);

    const roles = [...(await rolesOf(run.port, 3)).values()];

    expect(roles).toHaveLength(3);
    expect(roles.filter(role => role.jobs)).toHaveLength(1);
    expect(roles.filter(role => role.scheduling)).toHaveLength(1);
    expect(roles.find(role => role.jobs)?.scheduling).toBe(true);
  }, 60_000);

  it('hands the jobs to the replacement of the worker that ran them, and to nobody else', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);
    const before = await rolesOf(run.port, 3);
    const [victim] = [...before].find(([, role]) => role.jobs) ?? [];
    if (victim === undefined) {
      throw new Error('no worker runs the jobs');
    }

    process.kill(victim, 'SIGKILL');
    const deadline = Date.now() + 30_000;
    let after = new Map<number, Role>();
    while (Date.now() < deadline) {
      try {
        after = await rolesOf(run.port, 3);
        if (after.size === 3 && !after.has(victim) && [...after.values()].some(role => role.scheduling)) {
          break;
        }
      } catch {
        // A connection the dead worker held.
      }

      await sleep(200);
    }

    const roles = [...after.values()];
    expect(after.has(victim)).toBe(false);
    expect(roles.filter(role => role.jobs)).toHaveLength(1);
    expect(roles.filter(role => role.scheduling)).toHaveLength(1);
  }, 90_000);

  it('keeps one action kv for every worker: a counter counts every request once', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);

    const answers = [];
    for (let index = 0; index < 30; index += 1) {
      answers.push(await fleet(run.port, 'kv/increment?key=hits', asNumber));
    }

    expect(new Set(answers.map(answer => answer.pid)).size).toBeGreaterThan(1);
    expect(answers.map(answer => answer.value)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect([...(await fromEach(run.port, 'kv/get?key=hits', 3, asNumber)).values()]).toEqual([30, 30, 30]);
  }, 60_000);

  it('counts concurrent increments from every worker exactly once', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);

    const answers = await Promise.all(
      Array.from({ length: 60 }, () => fleet(run.port, 'kv/increment?key=burst', asNumber))
    );

    expect(new Set(answers.map(answer => answer.value)).size).toBe(60);
    expect(Math.max(...answers.map(answer => answer.value))).toBe(60);
  }, 60_000);

  it('keeps one job queue: a job enqueued through every worker is there once, and claimed once', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);

    const enqueued = await fromEach(run.port, 'queue/enqueue?key=job-1', 3, asBoolean);
    expect([...enqueued.values()].filter(Boolean)).toHaveLength(1);
    expect([...(await fromEach(run.port, 'queue/now', 3, asBoolean)).values()]).toEqual([true, true, true]);

    const claims = await Promise.all(Array.from({ length: 9 }, () => fleet(run.port, 'queue/claim', asStrings)));
    expect(claims.flatMap(claim => claim.value)).toEqual(['job-1']);
  }, 60_000);

  it('reads back a draft written through one worker from another, and only once', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);

    const writer = (await fleet(run.port, 'draft/put?key=draft-1', asBoolean)).pid;
    const asTake = (value: unknown): boolean | 'declined' => (value === 'declined' ? value : asBoolean(value));
    let reader: { pid: number; value: boolean | 'declined' } | undefined;
    for (let attempt = 0; attempt < 60 && (reader === undefined || reader.value === 'declined'); attempt += 1) {
      reader = await fleet(run.port, `draft/take?key=draft-1&unless=${writer}`, asTake);
    }

    expect(reader?.pid).not.toBe(writer);
    expect(reader?.value).toBe(true);
    expect([...(await fromEach(run.port, 'draft/take?key=draft-1', 3, asBoolean)).values()]).toEqual([
      false,
      false,
      false
    ]);
  }, 60_000);

  it('counts sign-in attempts once for all its workers', async () => {
    const run = await start({ WORKERS: '3' });
    await untilServing(run);

    const verdicts = [];
    for (let index = 0; index < 12; index += 1) {
      verdicts.push(await fleet(run.port, 'login?key=ada', asVerdict));
    }

    expect(new Set(verdicts.map(verdict => verdict.pid)).size).toBeGreaterThan(1);
    expect(verdicts.map(verdict => verdict.value.allowed)).toEqual([...Array<boolean>(10).fill(true), false, false]);
  }, 60_000);

  it('keeps everything in its own process with one worker, jobs included', async () => {
    const run = await start({ WORKERS: '1' });
    await untilServing(run);

    expect((await fleet(run.port, 'kv/increment?key=solo', asNumber)).value).toBe(1);
    expect((await fleet(run.port, 'kv/increment?key=solo', asNumber)).value).toBe(2);
    expect([...(await rolesOf(run.port, 1)).values()]).toEqual([{ jobs: true, scheduling: true }]);
  }, 60_000);

  it('replaces a worker that an uncaught error brings down', async () => {
    const run = await start({ WORKERS: '2' });
    await untilServing(run);
    const before = await servingPids(run.port, 2);

    const crashed = Number((await get(run.port, '/crash')).body);
    const deadline = Date.now() + 30_000;
    let after = new Set<number>();
    while (Date.now() < deadline && (after.size < 2 || after.has(crashed))) {
      await sleep(200);
      after = await servingPids(run.port, 2).catch(() => new Set<number>());
    }

    expect(before.has(crashed)).toBe(true);
    expect(after.size).toBe(2);
    expect(after.has(crashed)).toBe(false);
    expect(run.output()).toMatch(/a bug nobody caught/);
    expect(run.output()).toMatch(/stopped \(code 1\); starting another/);
  }, 60_000);

  it('waits longer before each replacement when its workers keep crashing, and keeps serving', async () => {
    const run = await start({ WORKERS: '2' });
    await untilServing(run);

    for (let crash = 0; crash < 4; crash += 1) {
      await untilServing(run);
      await get(run.port, '/crash').catch(() => undefined);
      await sleep(100);
    }

    await untilServing(run);
    const deadline = Date.now() + 30_000;
    let pids = new Set<number>();
    while (Date.now() < deadline && pids.size < 2) {
      pids = await servingPids(run.port, 2).catch(() => new Set<number>());
    }

    expect(run.output()).toMatch(/starting another in 500ms — 3 have stopped in the last minute/);
    expect(pids.size).toBe(2);
    expect(run.child.exitCode).toBeNull();
  }, 90_000);

  it('keeps serving through a replacement that cannot start, and recovers once it can', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'workers-boot-'));
    const marker = path.join(dir, 'database-down');

    try {
      const run = await start({ WORKERS: '2', BOOT_FAIL_FILE: marker });
      await untilServing(run);
      const [victim, survivor] = await servingPids(run.port, 2);

      writeFileSync(marker, '');
      process.kill(victim, 'SIGKILL');
      await sleep(1_500);

      // The replacement keeps failing, and the fleet neither stops nor stops serving.
      expect(run.child.exitCode).toBeNull();
      expect(run.output()).toMatch(/cannot start: the database is down/);
      expect(await servingPids(run.port, 1)).toEqual(new Set([survivor]));

      rmSync(marker);
      const deadline = Date.now() + 30_000;
      let pids = new Set<number>();
      while (Date.now() < deadline && pids.size < 2) {
        await sleep(200);
        pids = await servingPids(run.port, 2).catch(() => new Set<number>());
      }

      expect(pids.size).toBe(2);
      expect(pids.has(survivor)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);

  it('leaves no worker behind when its primary is killed outright', async () => {
    const run = await start({ WORKERS: '2' });
    await untilServing(run);
    const workers = await servingPids(run.port, 2);

    run.child.kill('SIGKILL');
    await run.exited;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && [...workers].some(isAlive)) {
      await sleep(100);
    }

    expect([...workers].filter(isAlive)).toEqual([]);
    await expect(get(run.port)).rejects.toThrow();
  }, 60_000);
});
