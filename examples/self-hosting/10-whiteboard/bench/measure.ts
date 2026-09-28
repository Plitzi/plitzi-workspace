import type { CDPSession, Page } from '@playwright/test';

declare global {
  interface Window {
    /** Set while a scenario is measured: stops the frame sampler and answers the gaps it saw. */
    benchStop?: () => number[];
  }
}

/**
 * What one scenario cost the page, measured from inside it and from the browser's own counters.
 *
 * Frames are the gaps between `requestAnimationFrame` callbacks while the scenario runs — what a person perceives as
 * smooth or not. A frame over 50 ms is a stutter anybody notices; `worst` is the longest the page was frozen. The
 * browser's counters say where the time went: script, style and layout, and every task on the main thread, over the
 * same window.
 */
export type Measurement = {
  frames: number;
  p50: number;
  p95: number;
  worst: number;
  /** Frames longer than 50 ms. */
  stutters: number;
  /** Main-thread time in the window, in ms: everything, and the part spent running script. */
  taskMs: number;
  scriptMs: number;
  /** The JS heap when the scenario ended, in MB. */
  heapMb: number;
  /** Wall time of the scenario, in ms. */
  wallMs: number;
};

const metric = (metrics: { name: string; value: number }[], name: string): number =>
  metrics.find(entry => entry.name === name)?.value ?? 0;

const percentile = (sorted: number[], at: number): number =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(at * (sorted.length - 1)))] : 0;

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * What opening a page cost: the sampler goes in before the page exists — through an init script, which survives the
 * navigation `act` makes — so the frames of the load itself are counted, from the first one the page drew.
 */
export const measureLoad = async (page: Page, cdp: CDPSession, act: () => Promise<void>): Promise<Measurement> => {
  await page.addInitScript(() => {
    const frames: number[] = [];
    let last = performance.now();
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.benchStop = () => frames.splice(0);
  });

  return summarise(page, cdp, act);
};

/** Runs `act` on `page` and answers what it cost. The page must be open; the session is the page's CDP session. */
export const measure = async (page: Page, cdp: CDPSession, act: () => Promise<void>): Promise<Measurement> => {
  await page.evaluate(() => {
    const frames: number[] = [];
    let last = performance.now();
    let measuring = true;
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      if (measuring) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
    window.benchStop = () => {
      measuring = false;

      return frames;
    };
  });

  return summarise(page, cdp, act);
};

/** The window around `act`: the browser's counters before and after, and the frames the page's sampler kept. */
const summarise = async (page: Page, cdp: CDPSession, act: () => Promise<void>): Promise<Measurement> => {
  const before = (await cdp.send('Performance.getMetrics')).metrics;
  const started = Date.now();
  await act();
  const wallMs = Date.now() - started;
  const after = (await cdp.send('Performance.getMetrics')).metrics;
  const frames = await page.evaluate(() => window.benchStop?.() ?? []);
  // The first gap spans the scenario's setup, not a frame the page drew.
  const drawn = frames.slice(1);
  const sorted = [...drawn].sort((a, b) => a - b);

  return {
    frames: drawn.length,
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    worst: round(sorted.at(-1) ?? 0),
    stutters: drawn.filter(frame => frame > 50).length,
    taskMs: Math.round((metric(after, 'TaskDuration') - metric(before, 'TaskDuration')) * 1000),
    scriptMs: Math.round((metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) * 1000),
    heapMb: round(metric(after, 'JSHeapUsedSize') / 1024 / 1024),
    wallMs
  };
};
