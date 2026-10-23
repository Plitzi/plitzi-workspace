import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keptToParts, keptToReference } from './apart';
import { answeredImage, HOST_TROUBLE, throttledImage } from './inspect';
import { runPaths } from '../../runs/paths';
import { keptName } from '../../runs/reference';
import { benchPlan, makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { CheckReport } from './types';
import type { KeptPage } from '../../runs/reference';
import type { Bench } from '../../tests/runProject';

const report = (issues: CheckReport['issues']): CheckReport => ({
  path: '/',
  width: 1440,
  ok: false,
  checked: 40,
  problems: issues.map(issue => issue.message),
  issues,
  hiddenAtWidth: [],
  empty: [],
  consoleErrors: [],
  failedRequests: [],
  devTools: true,
  lists: {}
});

const parts = { ids: new Set(['home-times']), all: new Set(['home-times', 'home-video-main']) };

describe('a page checked in a task’s copy', () => {
  it('passes on its own part, the other tasks’ findings said apart', () => {
    const kept = keptToParts(
      report([
        { code: 'label-wraps', message: 'home-video-main’s label wraps', elementId: 'home-video-main', width: 1440 }
      ]),
      parts
    );

    expect(kept).toMatchObject({ ok: true, issues: [], apart: ['home-video-main’s label wraps'] });
  });

  it('still fails on its own elements, and on what no element names', () => {
    const own = keptToParts(
      report([{ code: 'label-wraps', message: 'home-times wraps', elementId: 'home-times', width: 1440 }]),
      parts
    );
    const page = keptToParts(
      report([{ code: 'page-status', message: 'the page was sent with status 500', width: 390 }]),
      parts
    );

    expect(own.ok).toBe(false);
    expect(page.ok).toBe(false);
  });
});

describe('an image the browser was answered for', () => {
  it('is loaded, though it draws no size of its own — an SVG flag with only a viewBox', () => {
    const answered = new Set(['https://cdn.example.com/flags/es.svg']);

    expect(
      answeredImage(
        { code: 'image-not-loaded', message: 'an image never loaded: https://cdn.example.com/flags/es.svg' },
        answered
      )
    ).toBe(true);
    expect(
      answeredImage(
        { code: 'image-not-loaded', message: 'an image never loaded: https://cdn.example.com/flags/xx.svg' },
        answered
      )
    ).toBe(false);
  });
});

describe('an image its host held back (429)', () => {
  it('is the host’s limit, named apart — never the page’s failure', () => {
    const throttled = new Set(['https://cdn.example.com/flags/es.svg']);
    const issue = (address: string) => ({ code: 'image-not-loaded', message: `an image never loaded: ${address}` });

    expect(throttledImage(issue('https://cdn.example.com/flags/es.svg'), throttled)).toBe(
      'https://cdn.example.com/flags/es.svg'
    );
    expect(throttledImage(issue('https://cdn.example.com/flags/xx.svg'), throttled)).toBeUndefined();
    expect(
      throttledImage({ code: 'broken-link', message: 'https://cdn.example.com/flags/es.svg' }, throttled)
    ).toBeUndefined();
  });

  // velada-fidelity: "64 images from cdn.infolavelada.com did not load" names no address, and failed every check.
  it('is the host’s too when its images are said together, and it held back any of them', () => {
    const grouped = (host: string) => ({
      code: 'image-not-loaded',
      message: `64 images from ${host} did not load (illojuan-640.webp, es.svg, thegrefg-640.webp, …) — its server is slow, refuses this browser, or never answers`
    });

    expect(throttledImage(grouped('cdn.example.com'), new Set(['https://cdn.example.com/flags/es.svg']))).toBe(
      'cdn.example.com'
    );
    expect(throttledImage(grouped('cdn.example.com'), new Set(['https://other.example.com/a.png']))).toBeUndefined();
  });
});

// velada-polish: a CDN rate-limiting every request — connections reset, never answered — failed dev-1's checks three
// times, and a rerun passed: a busy host's, never the page's. A name that resolves to nothing stays the page's.
describe('a host that lets an image go', () => {
  it('is busy when it times out, resets or closes — and the page’s when its name resolves to nothing', () => {
    for (const said of [
      'net::ERR_TIMED_OUT',
      'net::ERR_CONNECTION_RESET',
      'net::ERR_EMPTY_RESPONSE',
      'net::ERR_HTTP2_PROTOCOL_ERROR'
    ]) {
      expect(HOST_TROUBLE.test(said)).toBe(true);
    }

    expect(HOST_TROUBLE.test('net::ERR_NAME_NOT_RESOLVED')).toBe(false);
  });
});

// lx-copy: the original's "TARJETAS GRÁFICAS" wraps under its tile; label-wraps failed every check of a faithful copy.
describe('a label wrapped as the original wraps it', () => {
  let bench: Bench;
  const { open } = runSteps(() => bench);

  beforeEach(async () => {
    bench = await makeBench();
  });

  afterEach(async () => {
    await bench.cleanup();
  });

  const wraps = (label: string): CheckReport['issues'][number] => ({
    code: 'label-wraps',
    message: `${label} breaks onto 2 lines`,
    elementId: 'collection-tile-link',
    label,
    width: 1440
  });

  it('fails nothing in a run that keeps the original wrapping it, and is said — another label still fails', async () => {
    const runId = await open({ ...benchPlan(), reference: 'https://www.example.com' });
    const dir = runPaths(bench.root, runId).reference;
    const kept: KeptPage = {
      url: 'https://www.example.com/',
      width: 1440,
      scheme: 'light',
      at: '2026-10-22T22:33:00.000Z',
      texts: [
        {
          text: 'TARJETAS GRÁFICAS',
          tag: 'span',
          x: 0,
          y: 0,
          width: 160,
          height: 38,
          fontSize: 14,
          fontWeight: '700',
          lineHeight: '19.6px',
          letterSpacing: 'normal',
          fontFamily: 'dm sans',
          color: 'rgb(0, 0, 0)',
          background: 'transparent',
          padding: '0px',
          radius: '0px'
        }
      ],
      unloaded: 0,
      decorations: []
    };
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${keptName('/', 1440, 'light')}.json`), JSON.stringify(kept));

    const [asOriginal] = await keptToReference(bench.root, [report([wraps('TARJETAS GRÁFICAS')])]);
    expect(asOriginal).toMatchObject({
      ok: true,
      issues: [],
      asTheOriginal: ['"TARJETAS GRÁFICAS" wraps as the original\'s does at 1440 px']
    });

    const [squeezed] = await keptToReference(bench.root, [report([wraps('COMBOS DE OFICINA')])]);
    expect(squeezed).toMatchObject({ ok: false, issues: [{ label: 'COMBOS DE OFICINA' }] });
  });

  it('keeps every finding outside a run that keeps a reference', async () => {
    const [kept] = await keptToReference(bench.root, [report([wraps('TARJETAS GRÁFICAS')])]);
    expect(kept).toMatchObject({ ok: false, issues: [{ code: 'label-wraps' }] });
  });
});
