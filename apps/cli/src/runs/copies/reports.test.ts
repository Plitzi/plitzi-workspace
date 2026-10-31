import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { handReports, reportsDir, reportText } from './reports';
import { makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { loadRun, readRunLog } from '../run';
import { readInbox } from '../talk/talk';

import type { Bench } from '../../tests/runProject';
import type { RunReport } from '@plitzi/sdk-shared/runs';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open } = runSteps(() => bench);

// A run's lead got "with tornadoes selected Strongest breaks" and reproduced it by guessing the URL, the layers, the width.
const report: RunReport = {
  text: 'Strongest breaks with only tornadoes on',
  path: '/?sample=active',
  seenOn: '/storms/champi',
  width: 390,
  height: 844,
  pageWidth: 340,
  scheme: 'dark',
  element: 'strongest',
  steps: [
    { kind: 'click', element: 'sheet-tab-summary' },
    { kind: 'click', element: 'layer-quakes' },
    { kind: 'type', element: 'log-search', text: "it's" },
    { kind: 'type', element: 'note', text: `"a" isn't b` },
    { kind: 'type', element: 'pin', secret: true }
  ],
  earlier: 2,
  at: '2026-10-31T10:00:00.000Z'
};

describe('a report from the preview’s page', () => {
  it('says what the person saw, where, and the command that plays it again', () => {
    expect(reportText(report, 'http://127.0.0.1:8300').split('\n')).toEqual([
      `The person reports from the preview, at 390×844 dark (the dev tools' panel open: the page 340 px wide): "Strongest breaks with only tornadoes on"`,
      'They were on /storms/champi, where their steps took them from /?sample=active.',
      'Pointed at: strongest.',
      `What they did: click sheet-tab-summary; click layer-quakes; type log-search "it's"; type note "<the text below>"; type pin "<the password>" (2 earlier left out).`,
      'A password typed into pin was not sent: write it in its place.',
      `What they typed into note holds both quote marks, which no step writes — type it there: "a" isn't b`,
      `Play it: plitzi page shot '/?sample=active' --url http://127.0.0.1:8300 --width 390 --height 844 --scheme dark --steps 'click sheet-tab-summary; click layer-quakes; type log-search "it'\\''s"; type note "<the text below>"; type pin "<the password>"' --within strongest`
    ]);
  });

  it('reaches the lead as the person’s message, logged, and leaves nothing behind — one that is no report kept apart', async () => {
    const runId = await open();
    const loaded = await loadRun(lead(), runId);
    const dir = reportsDir(loaded.paths);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, '1-a.json'),
      JSON.stringify({ ...report, steps: [], element: undefined, seenOn: undefined })
    );
    await fs.writeFile(path.join(dir, '2-b.json'), '{"text":"half');

    await handReports(lead(), loaded, 'http://127.0.0.1:8300');

    const inbox = await readInbox(lead(), runId);
    expect(inbox.map(message => [message.from, message.text.split('\n')[1]])).toEqual([
      ['person', 'Pointed at nothing: the page as a whole.']
    ]);
    expect(await fs.readdir(dir)).toEqual(['2-b.json.refused']);
    expect(
      (await readRunLog(loaded.paths))
        .filter(entry => String(entry.action).startsWith('report'))
        .map(entry => [entry.by, entry.action])
    ).toEqual([
      ['person', 'report'],
      ['person', 'report-refused']
    ]);
  });

  it('that cannot be handed is kept apart and said once, never tried again every round', async () => {
    const runId = await open();
    const loaded = await loadRun(lead(), runId);
    const dir = reportsDir(loaded.paths);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, '1-a.json'), JSON.stringify(report));
    // Where the run keeps its messages is a file: no message can be written.
    await fs.rm(loaded.paths.messages, { recursive: true, force: true });
    await fs.writeFile(loaded.paths.messages, '');

    await handReports(lead(), loaded, 'http://127.0.0.1:8300');
    await handReports(lead(), loaded, 'http://127.0.0.1:8300');

    expect(await fs.readdir(dir)).toEqual(['1-a.json.failed']);
    expect(
      (await readRunLog(loaded.paths)).filter(entry => entry.action === 'report-failed').map(entry => entry.file)
    ).toEqual(['1-a.json.failed']);
  });
});
