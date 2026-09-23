import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describeTarget, expect, test } from '../../fixtures';
import { boardJob, callAction, scheduleBoard } from '../../helpers/schedules';

import type { ChildProcess } from 'node:child_process';

/**
 * The schedules example's "Two replicas" section, done the way its README tells a reader to do it: a second process on
 * another port, pointed at the same queue file.
 *
 * The spec beside this one checks the example against the replica the suite boots. This one boots its OWN pair, because
 * what the README promises about two of them — one heartbeat a minute, a backlog shared, a job surviving a `kill -9` —
 * needs a process this spec can kill, and a queue file nobody else is writing to.
 */

const EXAMPLE_DIR = path.resolve(import.meta.dirname, '../../../examples/05-with-server-actions/05-schedules');

type Replica = { name: string; origin: string; process: ChildProcess; output: string[] };

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('no port was assigned'));
        }
      });
    });
  });

/**
 * One replica, started as the README's `yarn start` starts it, and waited for until its page answers.
 *
 * `node --import tsx` is that script's own command, run directly so the pid this spec kills is the server's — not a
 * package manager's that would outlive it.
 */
const boot = async (name: string, queueFile: string): Promise<Replica> => {
  const port = await freePort();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', 'src/main.ts'], {
    cwd: EXAMPLE_DIR,
    env: { ...process.env, PORT: String(port), QUEUE_DB: queueFile, REPLICA: name },
    stdio: 'pipe'
  });

  const replica: Replica = { name, origin: `http://127.0.0.1:${port}`, process: child, output: [] };
  const keep = (chunk: Buffer) => {
    replica.output.push(chunk.toString());
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited while booting:\n${replica.output.join('').slice(-2000)}`);
    }

    const up = await fetch(replica.origin)
      .then(response => response.ok)
      .catch(() => false);
    if (up) {
      return replica;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`${name} never answered:\n${replica.output.join('').slice(-2000)}`);
};

/** The code the replica exited with — `null` when a signal ended it rather than the process itself. */
const exited = (replica: Replica): Promise<number | null> =>
  new Promise(resolve => {
    if (replica.process.exitCode !== null || replica.process.signalCode !== null) {
      resolve(replica.process.exitCode);

      return;
    }

    replica.process.once('exit', code => {
      resolve(code);
    });
  });

const alive = (replica: Replica): boolean => replica.process.exitCode === null && replica.process.signalCode === null;

describeTarget('server-actions-schedules', () => {
  test.describe('two replicas over one queue file', () => {
    test.describe.configure({ mode: 'serial' });

    let queueDir = '';
    let queueFile = '';
    let replicas: Replica[] = [];

    test.beforeAll(async () => {
      test.setTimeout(90_000);
      queueDir = mkdtempSync(path.join(tmpdir(), 'plitzi-schedules-pair-'));
      queueFile = path.join(queueDir, 'queue.db');

      // One after the other: the first creates the file's tables, and the README's second terminal comes second too.
      replicas = [await boot('replica-a', queueFile), await boot('replica-b', queueFile)];
    });

    test.afterAll(async () => {
      await Promise.all(
        replicas.map(async replica => {
          replica.process.kill('SIGKILL');
          await exited(replica);
        })
      );
      rmSync(queueDir, { recursive: true, force: true });
    });

    test('both serve the same board', async ({ request }) => {
      const [a, b] = replicas;
      const fromA = await scheduleBoard(request, a.origin);
      const fromB = await scheduleBoard(request, b.origin);

      expect(fromA.servedBy).toContain('served by replica-a');
      expect(fromB.servedBy).toContain('served by replica-b');
      expect(fromB.schedules).toEqual(fromA.schedules);
    });

    // First, while the activity feed holds nothing else: it keeps the latest ten lines, and the heartbeat's has to be
    // among them to be counted.
    test('the heartbeat fires once a minute, however many replicas sweep', async ({ request }) => {
      // The next minute boundary, then a sweep: up to a minute and a few seconds.
      test.setTimeout(100_000);
      const [a] = replicas;

      await expect
        .poll(
          async () => {
            const beats = (await scheduleBoard(request, a.origin)).jobs.filter(job => job.name === 'Minute heartbeat');

            return beats.length > 0 && beats.every(job => job.status === 'succeeded');
          },
          { timeout: 85_000, intervals: [1_000] }
        )
        .toBe(true);

      const board = await scheduleBoard(request, a.origin);
      const beats = board.jobs.filter(job => job.name === 'Minute heartbeat');
      const fired = board.activity.filter(entry => entry.message === 'The minute cron fired');

      // Both replicas swept the same fire; one of them produced it, and one of them ran it. A feed line per job is
      // the whole claim — a second line for one fire is the email going out twice.
      expect(fired).toHaveLength(beats.length);
      expect(beats.every(job => /^#1 succeeded on replica-[ab]$/.test(job.history))).toBe(true);
    });

    test('a backlog is shared between them', async ({ request }) => {
      test.setTimeout(60_000);
      const [a, b] = replicas;

      // Queued through both, as a load balancer would spread the clicks — one after another, as four clicks are: the
      // same input at the same instant is one call to the run guards, however many times it is sent. Each replica runs
      // two jobs at once and each job takes three seconds, so one replica cannot drain four alone before the other
      // one polls.
      const ids: string[] = [];
      for (const replica of [a, b, a, b]) {
        const { status, body } = await callAction(request, replica.origin, 'start-export', { seconds: 3 });
        expect(status).toBe(200);
        ids.push(body.output.jobId);
      }

      await expect
        .poll(
          async () => {
            const jobs = await Promise.all(ids.map(id => boardJob(request, a.origin, id)));

            return jobs.every(job => job?.status === 'succeeded');
          },
          { timeout: 40_000 }
        )
        .toBe(true);

      const jobs = await Promise.all(ids.map(id => boardJob(request, b.origin, id)));
      const ranOn = new Set(jobs.map(job => job?.history.replace(/^#1 succeeded on /, '')));
      expect(ranOn).toEqual(new Set(['replica-a', 'replica-b']));
    });

    /**
     * A deploy: `^C` (SIGTERM) on the replica running an export, and a new replica in its place.
     *
     * Twelve seconds of work against a ten-second lease: a replica that stopped renewing its claim while it waited
     * would see the other one take the export over and run it a second time.
     */
    test('a replica told to stop finishes its job first, and leaves the rest to the one staying', async ({
      request
    }) => {
      test.setTimeout(60_000);
      const [a] = replicas;

      const { body } = await callAction(request, a.origin, 'start-export', { seconds: 12 });
      const jobId = body.output.jobId;
      await expect
        .poll(async () => (await boardJob(request, a.origin, jobId))?.status, { timeout: 15_000 })
        .toBe('running');

      const running = await boardJob(request, a.origin, jobId);
      const holder = replicas.find(replica => running?.detail.startsWith(`on ${replica.name} `));
      const staying = replicas.find(replica => replica !== holder && alive(replica));
      if (!holder || !staying) {
        throw new Error(`the running job names no replica this spec booted: ${running?.detail ?? 'no job'}`);
      }

      holder.process.kill('SIGTERM');
      const exit = exited(holder);

      // Queued while it drains: the stopping replica does not take it, the one staying does.
      const queued = await callAction(request, staying.origin, 'start-export', { seconds: 1 });
      expect(queued.status).toBe(200);

      expect(await exit).toBe(0);
      // Gone only once the export was done — on the replica that started it, once.
      expect(await boardJob(request, staying.origin, jobId)).toMatchObject({
        status: 'succeeded',
        history: `#1 succeeded on ${holder.name}`
      });

      await expect
        .poll(async () => (await boardJob(request, staying.origin, queued.body.output.jobId))?.history, {
          timeout: 15_000
        })
        .toBe(`#1 succeeded on ${staying.name}`);

      // The updated replica, on the same queue file.
      replicas.push(await boot('replica-c', queueFile));
    });

    test('a replica killed mid-job leaves it to the other one', async ({ request }) => {
      // A ten-second lease, then the dead replica's single-flight key — the run timeout, thirty seconds here — before
      // the survivor may run it: see the README.
      test.setTimeout(90_000);
      const a = replicas.find(alive);
      if (!a) {
        throw new Error('no replica is running');
      }

      const { body } = await callAction(request, a.origin, 'start-export', { seconds: 5 });
      const jobId = body.output.jobId;

      await expect
        .poll(async () => (await boardJob(request, a.origin, jobId))?.status, { timeout: 15_000 })
        .toBe('running');

      const running = await boardJob(request, a.origin, jobId);
      const holder = replicas.find(replica => running?.detail.startsWith(`on ${replica.name} `));
      const survivor = replicas.find(replica => replica !== holder && alive(replica));
      if (!holder || !survivor) {
        throw new Error(`the running job names no replica this spec booted: ${running?.detail ?? 'no job'}`);
      }

      // `kill -9`: no drain, no settlement, no heartbeat.
      holder.process.kill('SIGKILL');
      await exited(holder);

      await expect
        .poll(async () => (await boardJob(request, survivor.origin, jobId))?.status, { timeout: 70_000 })
        .toBe('succeeded');

      expect((await boardJob(request, survivor.origin, jobId))?.history).toBe(
        `#1 lost on ${holder.name} · #2 succeeded on ${survivor.name}`
      );
    });
  });
});
