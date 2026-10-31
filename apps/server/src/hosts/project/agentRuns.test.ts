import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ACTIVE_RUN_FILE } from '@plitzi/sdk-shared/project';
import { RUN_REPORT_PATH, RUN_STATUS_PATH } from '@plitzi/sdk-shared/runs';

import { runReportStage, runStatusStage, watchAgentRuns } from './agentRuns';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { unusedPort } from '../../core/unusedPort';
import { offlineDataOf } from '../../modules/ssr/tests/offlineData';

import type { SSRServer } from '@plitzi/sdk-shared';

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

/**
 * A run's preview tells its page there is a run, and only it: the dev tools ask `RUN_STATUS_PATH` where the payload says
 * `runStatus`, and nowhere else — asked of every server, each page in debug mode logged a 404 every three seconds.
 */
describe('runStatusStage', () => {
  const offlineData = offlineDataOf();
  const started: SSRServer[] = [];
  // Its own folder: `afterEach` clears the projects the tests above make, and the servers read this one throughout.
  const folder = mkdtempSync(path.join(os.tmpdir(), 'agent-runs-status-'));
  const snapshot = path.join(folder, 'snapshot.json');
  let preview: string;
  let bare: string;
  let undebuggable: string;

  const serve = async ({ preview, debugMode }: { preview: boolean; debugMode?: boolean }): Promise<string> => {
    const port = await unusedPort();
    const server = createServer(
      {
        port,
        devMode: true,
        ...(debugMode === undefined ? {} : { debugMode }),
        adapters: createJsonAdapters({ offlineData })
      },
      preview ? { preAuth: [runStatusStage(snapshot)] } : {}
    );
    await server.listen(port, '127.0.0.1');
    started.push(server);

    return `http://127.0.0.1:${String(port)}`;
  };

  const page = async (origin: string): Promise<string> => (await fetch(`${origin}/`)).text();

  beforeAll(async () => {
    writeFileSync(snapshot, JSON.stringify({ run: 'es-launch' }));
    [preview, bare, undebuggable] = await Promise.all([
      serve({ preview: true }),
      serve({ preview: false }),
      serve({ preview: true, debugMode: false })
    ]);
  });

  afterAll(async () => {
    await Promise.all(started.map(server => server.close()));
    rmSync(folder, { recursive: true, force: true });
  });

  it('says to the page that may debug it that there is a run, and answers the run where it says', async () => {
    expect(await page(preview)).toContain('"runStatus":true');
    expect(await (await fetch(`${preview}${RUN_STATUS_PATH}`)).json()).toEqual({ run: 'es-launch' });
  });

  it('says nothing of a run on a server that previews none, nor to a page nobody may debug', async () => {
    expect(await page(bare)).not.toContain('runStatus');
    expect((await fetch(`${bare}${RUN_STATUS_PATH}`)).status).toBe(404);
    expect(await page(undebuggable)).not.toContain('runStatus');
  });
});

// A run's lead got the person's words alone — "with tornadoes selected Strongest breaks" — and guessed the rest.
describe('runReportStage', () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'agent-runs-reports-'));
  const reports = path.join(folder, 'reports');
  let server: SSRServer;
  let origin: string;
  const report = {
    text: 'Strongest breaks with only tornadoes on',
    path: '/?sample=active',
    width: 1440,
    height: 900,
    scheme: 'dark',
    element: 'strongest',
    steps: [{ kind: 'click', element: 'layer-quakes' }],
    at: '2026-10-31T10:00:00.000Z'
  };
  const send = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${origin}${RUN_REPORT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });

  beforeAll(async () => {
    const port = await unusedPort();
    server = createServer(
      { port, devMode: true, adapters: createJsonAdapters({ offlineData: offlineDataOf() }) },
      { preAuth: [runReportStage(reports)] }
    );
    await server.listen(port, '127.0.0.1');
    origin = `http://127.0.0.1:${String(port)}`;
  });

  afterAll(async () => {
    await server.close();
    rmSync(folder, { recursive: true, force: true });
  });

  it('keeps a report as a file of its own, for the CLI to hand to the lead', async () => {
    const answer = await send(report);

    expect(answer.status).toBe(202);
    const [file] = readdirSync(reports);
    expect(JSON.parse(readFileSync(path.join(reports, file), 'utf-8'))).toEqual(report);
  });

  it('says every problem of one that is not a report, and keeps nothing of it', async () => {
    const before = readdirSync(reports).length;
    const answer = await send({ ...report, text: ' ', width: 0 });

    expect(answer.status).toBe(400);
    expect(((await answer.json()) as { problems: string[] }).problems).toEqual([
      'text: what is wrong, in words',
      'width and height: the window, in whole pixels'
    ]);
    expect(readdirSync(reports)).toHaveLength(before);
  });

  it('takes a report from the preview’s own page only, and by POST', async () => {
    expect((await send(report, { Origin: 'https://elsewhere.test', 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
    expect((await fetch(`${origin}${RUN_REPORT_PATH}`)).status).toBe(405);
  });
});
