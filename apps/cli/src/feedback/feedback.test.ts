import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { feedback } from '.';
import { reportTemplate } from './template';

import type { FeedbackAnswer } from '.';
import type { FeedbackFacts } from './facts';

let folder = '';

const answered = async (options: Parameters<typeof feedback>[0]): Promise<FeedbackAnswer> => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  log.mockClear();
  await feedback({ ...options, json: true });
  const printed = log.mock.calls.flat().join('\n');

  return JSON.parse(printed) as FeedbackAnswer;
};

beforeEach(async () => {
  folder = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-feedback-')));
  vi.spyOn(process, 'cwd').mockReturnValue(folder);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = 0;
  await fs.rm(folder, { recursive: true, force: true });
});

describe('plitzi feedback', () => {
  it('writes the page with what the CLI read in it, and says how to fill and publish it', async () => {
    await fs.writeFile(path.join(folder, 'package.json'), JSON.stringify({ name: 'shop' }));
    const answer = await answered({});

    expect(answer.file).toBe(path.join(folder, 'tmp/feedback', `report-${answer.facts.date}.html`));
    expect(answer.facts.node).toBe(process.version);
    const page = await fs.readFile(answer.file, 'utf-8');
    expect(page).toContain(`const FACTS = ${JSON.stringify(answer.facts, null, 2)}`);
    expect(page).toContain('const REPORT = {');
    expect(answer.brief).toContain('fill the REPORT object');
    expect(answer.brief).toContain('publish the file as a private artifact');
    expect(answer.brief).toContain('No earlier report: number the findings from PZ-1.');
  });

  it('never writes over an earlier report of the same day', async () => {
    const first = await answered({});
    const second = await answered({});

    expect(second.file).not.toBe(first.file);
    expect(path.basename(second.file)).toBe(`report-${second.facts.date}-2.html`);
  });

  it('continues the reports it is given, and refuses a link that is not one', async () => {
    // Any earlier report's link, in the shape claude.ai gives one — not a real report, which may expire.
    const url = 'https://claude.ai/artifact/earlier-report';
    const answer = await answered({ previous: [url] });

    expect(answer.brief).toContain(`  - ${url}`);
    // A link that no longer opens is said, never guessed past.
    expect(answer.brief).toContain('A link can stop opening');
    expect(await fs.readFile(answer.file, 'utf-8')).toContain(`const PREVIOUS = [\n  "${url}"\n]`);

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await feedback({ previous: ['https://example.com/report'] });
    expect(error.mock.calls.flat().join(' ')).toContain('is not one');
    expect(process.exitCode).toBe(1);
  });
});

describe('the report page', () => {
  // A value the CLI read is data in the page's script, whatever it holds.
  it('keeps the facts inside its script', () => {
    const facts: FeedbackFacts = {
      date: '2026-10-07',
      cli: '0.38.7',
      node: 'v24.0.0',
      os: 'darwin',
      packages: { '@plitzi/sdk-server': '0.38.7' },
      project: { name: '</script><script>alert(1)</script>', mode: 'server', source: 'local', runtime: false }
    };
    const page = reportTemplate(facts, []);

    expect(page.match(/<\/script>/g)).toHaveLength(1);
    expect(page).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
  });
});
