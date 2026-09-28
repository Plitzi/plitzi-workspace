import { writeFileSync } from 'node:fs';

import { chromium } from '@playwright/test';

import { seedBoard } from './boards.ts';
import { startCrowd } from './crowd.ts';
import { measure, measureLoad } from './measure.ts';
import { startServer } from './server.ts';
import { isRecord } from '../src/board/model.ts';

import type { Measurement } from './measure.ts';
import type { Browser, CDPSession, Page } from '@playwright/test';

/**
 * Pizarra under load, as a bench: boards of a thousand and four thousand elements, everything a person does to them —
 * open, look around, select, move, add, paste, delete, undo — and crowds of collaborators on them, measured in a real
 * browser against the production build. Each run writes `bench/results.md`, and `bench/results.json` beside it to
 * compare the next run against.
 *
 *   yarn bench                 every scenario
 *   yarn bench --size 1000     one board size
 *   yarn bench --only move     the scenarios whose name contains it
 *   yarn bench --cpu 4         on a CPU four times slower: a modest laptop, a phone
 *
 * A fast machine draws everything at 60 fps and hides what a frame costs; `--cpu` is how a change is judged on the
 * hardware people actually have. Throttled runs write `results-cpu4.md` (and `.json`), beside the full-speed ones.
 */

const args = process.argv.slice(2);
const option = (name: string): string[] =>
  args.flatMap((arg, index) => (arg === `--${name}` && args[index + 1] ? [args[index + 1]] : []));
const SIZES = option('size').map(Number).filter(Number.isFinite);
const ONLY = option('only');
const CPU = Math.max(1, Number(option('cpu').at(0) ?? 1) || 1);
const PORT = Number(process.env.BENCH_PORT ?? 4099);

type Row = { scenario: string; size: number } & Measurement;
type CrowdRow = {
  size: number;
  crowd: number;
  fanOutP50: number;
  fanOutP95: number;
  commitP50: number;
  commitP95: number;
  refused: number;
};

const rows: Row[] = [];
const crowdRows: CrowdRow[] = [];
const problems: string[] = [];

const wanted = (name: string) => !ONLY.length || ONLY.some(part => name.includes(part));

const percentile = (values: number[], at: number): number => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(at * (sorted.length - 1)))] : 0;
};

const settle = (page: Page, ms = 600) => page.waitForTimeout(ms);

type Saved = { id: string; type: string; x: number; deleted: boolean };

const isSaved = (value: unknown): value is Saved =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
  typeof value.x === 'number' &&
  typeof value.deleted === 'boolean';

/** The board as the server keeps it — what every scenario that changes it is checked against. */
const saved = async (origin: string, board: string): Promise<Saved[]> => {
  const body: unknown = await (await fetch(`${origin}/_rsc?location=/b/${board}&ids=board`)).json();
  const data = isRecord(body) && isRecord(body.serverData) ? body.serverData.board : undefined;

  return isRecord(data) && Array.isArray(data.elements) ? data.elements.filter(isSaved) : [];
};

const live = async (origin: string, board: string) => (await saved(origin, board)).filter(element => !element.deleted);

/** A scenario that changes the board did change it, as everyone else would see it: a stress test, not only a timer. */
const expectSaved = async (
  label: string,
  size: number,
  holds: () => Promise<boolean>,
  detail: () => Promise<string>
) => {
  // Commits are queued by the page; give the last of them time to land.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await holds()) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  problems.push(`${size}: ${label} — ${await detail()}`);
};

/** A drag of the mouse from one point to another, in `steps` moves — a hand's pace, one frame each. */
const drag = async (page: Page, from: [number, number], to: [number, number], steps = 60) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps });
  await page.mouse.up();
};

/**
 * A point on screen over an element, found the way a person finds one — by where the pointer turns into the hand that
 * moves things. The view is whatever the board opened or was left at, so no position can be assumed.
 */
const overAnElement = async (page: Page): Promise<[number, number]> => {
  for (let y = 300; y <= 700; y += 25) {
    for (let x = 400; x <= 1100; x += 25) {
      await page.mouse.move(x, y);
      // The canvas that takes the pointer — the board is drawn on another one under it.
      const cursor = await page.evaluate(
        () => document.querySelector('canvas[aria-label^="Board"]')?.getAttribute('style') ?? ''
      );
      if (/cursor:\s*move/.test(cursor)) {
        return [x, y];
      }
    }
  }

  throw new Error('No element under any point of the middle of the screen');
};

/** A page on the board, watched for errors and for refused changes — a stress test is also about what breaks. */
const openBoard = async (browser: Browser, size: number) => {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    // Copy and paste go through the system clipboard, which a headless browser only lends when asked.
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  page.on('pageerror', error => problems.push(`${size}: page error — ${error.message}`));
  page.on('response', response => {
    if (!response.url().endsWith('/_action')) {
      return;
    }

    void response
      .json()
      .then((body: unknown) => {
        if (typeof body === 'object' && body !== null && 'status' in body && body.status === 'failed') {
          const error = 'error' in body && typeof body.error === 'string' ? body.error : 'no reason given';
          problems.push(`${size}: an action was refused — ${error}`);
        }
      })
      .catch(() => undefined);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (CPU > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }

  return { page, cdp, close: () => context.close() };
};

const record = async (
  name: string,
  size: number,
  page: Page,
  cdp: CDPSession,
  act: () => Promise<void>,
  how: typeof measure = measure
) => {
  // A scenario left out by `--only` still runs — the ones after it start from what it leaves — and is only not measured.
  if (!wanted(name)) {
    await act();

    return;
  }

  const result = await how(page, cdp, act);
  rows.push({ scenario: name, size, ...result });
  console.log(
    `${String(size).padStart(5)}  ${name.padEnd(22)} p50 ${String(result.p50).padStart(5)}  p95 ${String(result.p95).padStart(6)}  worst ${String(result.worst).padStart(6)}  stutters ${String(result.stutters).padStart(3)}  script ${result.scriptMs} ms`
  );
};

const scenarios = async (browser: Browser, origin: string, size: number) => {
  const seeded = await seedBoard(origin, size);
  const url = `${origin}/b/${seeded.id}`;
  const { page, cdp, close } = await openBoard(browser, size);

  await record(
    'open',
    size,
    page,
    cdp,
    async () => {
      await page.goto(url);
      await page.locator('canvas').first().waitFor();
      await settle(page, 2500);
    },
    measureLoad
  );

  await record('idle', size, page, cdp, () => settle(page, 2000));
  await page.keyboard.press('h');
  await record('pan', size, page, cdp, async () => {
    await drag(page, [700, 450], [200, 200]);
    await drag(page, [200, 200], [700, 450]);
  });
  await page.keyboard.press('v');
  await record('zoom', size, page, cdp, async () => {
    await page.mouse.move(700, 450);
    await page.keyboard.down('Control');
    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(16);
    }

    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(16);
    }

    await page.keyboard.up('Control');
    await settle(page);
  });
  const count = async () => (await live(origin, seeded.id)).length;
  const firstX = async () => (await saved(origin, seeded.id)).find(element => element.id === first)?.x;
  // A note: a connector's own position never changes — it is drawn from what it connects.
  const first = (await saved(origin, seeded.id)).find(element => element.type === 'sticky')?.id;
  const drawnBefore = await count();
  await record('draw 20 shapes', size, page, cdp, async () => {
    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press('r');
      const x = 150 + (index % 10) * 100;
      const y = 120 + Math.floor(index / 10) * 90;
      await drag(page, [x, y], [x + 60, y + 50], 5);
    }

    await settle(page);
  });
  await expectSaved(
    'drawing 20 shapes did not keep them',
    size,
    async () => (await count()) === drawnBefore + 20,
    async () => `${(await count()) - drawnBefore} kept`
  );
  const all = await count();
  const xBefore = await firstX();
  // The first note of the board sits at the origin — on screen at the default view, where this starts.
  await record('select all', size, page, cdp, async () => {
    await page.keyboard.press('ControlOrMeta+a');
    await settle(page);
  });
  const grip = await overAnElement(page);
  await record('move all', size, page, cdp, async () => {
    await drag(page, grip, [grip[0] + 100, grip[1] + 80]);
    await settle(page, 1200);
  });
  await expectSaved(
    'moving everything did not keep it',
    size,
    async () => (await firstX()) !== xBefore,
    () => Promise.resolve(`the first element is still at ${String(xBefore)}`)
  );
  await record('undo move', size, page, cdp, async () => {
    await page.keyboard.press('ControlOrMeta+z');
    await settle(page, 1200);
  });
  await expectSaved(
    'undoing the move did not bring it back',
    size,
    async () => (await firstX()) === xBefore,
    async () => `the first element is at ${String(await firstX())}, not ${String(xBefore)}`
  );
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+F');
  await settle(page, 800);
  await record('marquee all', size, page, cdp, async () => {
    await drag(page, [80, 76], [1390, 890]);
    await settle(page);
  });
  if (size <= 1000) {
    // Everything, not what the marquee reached: the view is fitted edge to edge, and the marquee starts inside it.
    await page.keyboard.press('ControlOrMeta+a');
    await settle(page);
    await record('copy + paste', size, page, cdp, async () => {
      await page.keyboard.press('ControlOrMeta+c');
      await page.keyboard.press('ControlOrMeta+v');
      await settle(page, 1500);
    });
    await expectSaved(
      'pasting everything did not keep the copies',
      size,
      async () => (await count()) === all * 2,
      async () => `${await count()} on the board, ${all * 2} expected`
    );
    await page.keyboard.press('ControlOrMeta+z');
    await settle(page, 1200);
    await expectSaved(
      'undoing the paste did not take the copies away',
      size,
      async () => (await count()) === all,
      async () => `${await count()} on the board, ${all} expected`
    );
    await page.keyboard.press('ControlOrMeta+a');
    await settle(page);
  }

  await page.keyboard.press('ControlOrMeta+a');
  await settle(page);
  await record('delete all', size, page, cdp, async () => {
    await page.keyboard.press('Delete');
    await settle(page, 1200);
  });
  await expectSaved(
    'deleting everything did not keep it',
    size,
    async () => (await count()) === 0,
    async () => `${await count()} left`
  );
  await record('undo delete', size, page, cdp, async () => {
    await page.keyboard.press('ControlOrMeta+z');
    await settle(page, 1500);
  });
  await expectSaved(
    'undoing the delete did not bring everything back',
    size,
    async () => (await count()) === all,
    async () => `${await count()} of ${all}`
  );

  for (const crowdSize of [10, 50]) {
    const name = `crowd ${crowdSize}`;
    if (!wanted(name)) {
      continue;
    }

    await page.keyboard.press('Escape');
    const crowd = await startCrowd(origin, seeded.id, crowdSize, { writers: 3, commitEveryMs: 2000 });
    await settle(page, 1500);
    await record(`${name}: watch`, size, page, cdp, () => settle(page, 4000));
    await page.keyboard.press('h');
    await record(`${name}: pan`, size, page, cdp, async () => {
      await drag(page, [700, 450], [300, 250]);
      await drag(page, [300, 250], [700, 450]);
    });
    await page.keyboard.press('v');
    crowd.stop();
    crowdRows.push({
      size,
      crowd: crowdSize,
      fanOutP50: percentile(crowd.fanOut, 0.5),
      fanOutP95: percentile(crowd.fanOut, 0.95),
      commitP50: percentile(crowd.commits, 0.5),
      commitP95: percentile(crowd.commits, 0.95),
      refused: crowd.refused
    });
  }

  await close();
};

/** A Markdown table laid out as Prettier lays one out, so a run leaves the results as the formatter would. */
const table = (headers: string[], lines: (string | number)[][]): string => {
  const cells = [headers, ...lines.map(line => line.map(String))];
  const widths = headers.map((_, column) => Math.max(3, ...cells.map(row => row[column].length)));
  const row = (values: string[]) => `| ${values.map((value, column) => value.padEnd(widths[column])).join(' | ')} |`;

  return [row(headers), `| ${widths.map(width => '-'.repeat(width)).join(' | ')} |`, ...cells.slice(1).map(row)].join(
    '\n'
  );
};

const report = (): string =>
  [
    '# Pizarra bench',
    '',
    `${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · production build · Chromium ${chromium.name()} · 1400×900` +
      (CPU > 1 ? ` · CPU throttled ×${CPU}` : ''),
    '',
    'Frames are the gaps between `requestAnimationFrame` callbacks while the scenario ran, in ms — 16.7 is 60 fps. A',
    '_stutter_ is a frame over 50 ms. Script and task are main-thread time over the whole scenario.',
    '',
    'A frame rate only says the machine kept up. What is left over is what slower hardware has to spare: _script per',
    'frame_ is the script a drawn frame cost, and _busy_ the share of the scenario the main thread was working — the',
    'lower both are, the further down in hardware it stays smooth.',
    '',
    table(
      [
        'elements',
        'scenario',
        'p50',
        'p95',
        'worst',
        'stutters',
        'script ms',
        'script / frame',
        'task ms',
        'busy',
        'heap MB'
      ],
      rows.map(row => [
        row.size,
        row.scenario,
        row.p50,
        row.p95,
        row.worst,
        row.stutters,
        row.scriptMs,
        row.frames ? (row.scriptMs / row.frames).toFixed(2) : '–',
        row.taskMs,
        row.wallMs ? `${Math.round((row.taskMs / row.wallMs) * 100)}%` : '–',
        row.heapMb
      ])
    ),
    '',
    '## Crowds',
    '',
    'Simulated collaborators on the board: every one moving its cursor twenty times a second, three of them adding a',
    'note every two seconds. _Fan-out_ is from a note being sent to the last collaborator hearing it.',
    '',
    table(
      ['elements', 'collaborators', 'fan-out p50', 'fan-out p95', 'commit p50', 'commit p95', 'refused'],
      crowdRows.map(row => [
        row.size,
        row.crowd,
        row.fanOutP50,
        row.fanOutP95,
        row.commitP50,
        row.commitP95,
        row.refused
      ])
    ),
    '',
    '## What broke',
    '',
    problems.length ? problems.map(problem => `- ${problem}`).join('\n') : 'Nothing: no page error, no refused change.',
    ''
  ].join('\n');

const server = await startServer(PORT);
const browser = await chromium.launch();
try {
  for (const size of SIZES.length ? SIZES : [1000, 4000]) {
    await scenarios(browser, server.origin, size);
  }
} finally {
  await browser.close();
  await server.stop();
}

const here = new URL('.', import.meta.url);
const named = CPU > 1 ? `results-cpu${CPU}` : 'results';
writeFileSync(new URL(`${named}.md`, here), report());
writeFileSync(new URL(`${named}.json`, here), `${JSON.stringify({ cpu: CPU, rows, crowdRows, problems }, null, 2)}\n`);
console.log(`\n${problems.length} problem(s). Written to bench/${named}.md`);
