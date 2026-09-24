import http from 'node:http';

import { describeTarget, expect, test } from '../../../fixtures';
import { expectPageWhole } from '../../../helpers/harness';
import { expectSampleSpaceContent } from '../../../helpers/space';
import { sampleAuthored } from '../../../spaces';

type Answer = { status: number; servedBy: string; cache: string; body: string };

/** One request on a connection of its own: a kept-alive connection stays with one process, and would hide the rest. */
const fetchFresh = (url: string): Promise<Answer> =>
  new Promise((resolve, reject) => {
    const req = http.get(url, { agent: false, headers: { 'accept-encoding': 'identity' } }, res => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          servedBy: String(res.headers['x-served-by']),
          cache: String(res.headers['x-cache']),
          body
        })
      );
    });
    req.setTimeout(15_000, () => req.destroy(new Error(`no answer from ${url}`)));
    req.on('error', reject);
  });

/** What must not differ between two renders of the same page — the markup, without the per-response noise. */
const markupOf = (html: string): string =>
  (/<body[^>]*>([\s\S]*?)<script/.exec(html)?.[1] ?? html).replace(/\?v=[\w-]+/g, '');

describeTarget('workers-server', subject => {
  test('spreads its connections across more than one process', async () => {
    const answers = await Promise.all(Array.from({ length: 12 }, () => fetchFresh(subject.origin)));

    expect(answers.every(answer => answer.status === 200)).toBe(true);
    expect(new Set(answers.map(answer => answer.servedBy)).size).toBeGreaterThan(1);
  });

  test('renders the same page whichever process renders it', async () => {
    const answers = await Promise.all(Array.from({ length: 12 }, () => fetchFresh(subject.origin)));
    const byProcess = new Map(answers.map(answer => [answer.servedBy, markupOf(answer.body)]));

    expect(byProcess.size).toBeGreaterThan(1);
    expect(new Set(byProcess.values()).size).toBe(1);
    expect([...byProcess.values()][0]).toContain('Welcome To Plitzi');
  });

  test('answers a burst of requests at once without dropping one', async () => {
    const answers = await Promise.all(Array.from({ length: 60 }, () => fetchFresh(subject.origin)));

    expect(answers.filter(answer => answer.status !== 200)).toEqual([]);
  });

  test('hydrates into a complete, visible page, load after load', async ({ page }) => {
    for (let load = 0; load < 3; load += 1) {
      await page.goto(subject.origin);

      await expectSampleSpaceContent(page);
      await expectPageWhole(page, sampleAuthored(), { elements: 'all' });
    }
  });

  test('answers its health endpoint from every process', async () => {
    const answers = await Promise.all(Array.from({ length: 8 }, () => fetchFresh(`${subject.origin}/health`)));

    expect(answers.every(answer => answer.status === 200)).toBe(true);
    expect(answers.map(answer => JSON.parse(answer.body) as unknown)).toContainEqual({ role: 'e2e-workers', ok: true });
  });

  test('forgets a published page in every process when one of them is told to', async () => {
    const published = `${subject.origin}/?published`;
    const cachedIn = new Set<string>();
    for (let attempt = 0; attempt < 60 && cachedIn.size < 2; attempt += 1) {
      const answer = await fetchFresh(published);
      if (answer.cache === 'HIT') {
        cachedIn.add(answer.servedBy);
      }
    }

    expect(cachedIn.size).toBe(2);

    const told = await fetchFresh(`${subject.origin}/__invalidate`);
    expect(told.status).toBe(200);
    // The word goes from the process that was told, through the primary, to the other: two hops between processes.
    await new Promise(resolve => setTimeout(resolve, 200));

    const firstAfter = new Map<string, string>();
    for (let attempt = 0; attempt < 60 && firstAfter.size < 2; attempt += 1) {
      const answer = await fetchFresh(published);
      if (!firstAfter.has(answer.servedBy)) {
        firstAfter.set(answer.servedBy, answer.cache);
      }
    }

    expect([...firstAfter.values()]).toEqual(['MISS', 'MISS']);
  });
});
