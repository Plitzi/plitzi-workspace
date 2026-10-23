import http from 'node:http';

import { describe, expect, it } from 'vitest';

import { keeperServer } from './keeperServer';

import type { Route } from './keeperServer';
import type { KeptAnswer } from '../browser/keptBrowser';

/** An ask as `page measure` sends it — or any body — and what came back, or the error of a door closed. */
const post = (
  port: number,
  body: string,
  path = '/measure'
): Promise<{ status: number; body: unknown } | { error: string }> =>
  new Promise(resolve => {
    const request = http.request({ host: '127.0.0.1', port, path, method: 'POST' }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => (text += chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(text) as unknown }));
    });
    request.on('error', error => resolve({ error: error.message }));
    request.end(body);
  });

const asked = JSON.stringify({ url: 'https://site.test/', width: 1440, height: 900, targets: ['h1'] });

/** A route reading what it is asked as a measure: its targets each answered by `read`. */
const measuring =
  (read: (targets: string[]) => Promise<KeptAnswer>): Route =>
  async body => {
    const raw: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'targets') : undefined;
    const targets =
      Array.isArray(raw) && raw.every((each): each is string => typeof each === 'string') ? raw : undefined;

    return targets ? { status: 200, body: await read(targets) } : { status: 400, body: { problem: 'no targets' } };
  };

const until = async (condition: () => boolean): Promise<void> => {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};

// Carlos: a kept browser stopped at a run's end never closes under an ask it took.
describe('the kept browser’s door', () => {
  it('answers an ask with what was read, and refuses what is no ask', async () => {
    const door = keeperServer({
      routes: {
        '/measure': measuring(targets =>
          Promise.resolve({ readings: targets.map(target => ({ problem: `${target} read` })) })
        )
      },
      askMs: 5000,
      bodyBytes: 1024
    });
    const port = await door.listen();

    expect(await post(port, asked)).toEqual({ status: 200, body: { readings: [{ problem: 'h1 read' }] } });
    expect(await post(port, 'not json')).toEqual({ status: 400, body: { problem: 'an ask that is no JSON' } });
    expect(await post(port, JSON.stringify({ url: 'x' }))).toEqual({ status: 400, body: { problem: 'no targets' } });
    expect(await post(port, asked, '/other')).toMatchObject({ status: 404 });
    expect(await post(port, 'x'.repeat(2048))).toMatchObject({ status: 413 });
    await door.drain(0);
  });

  it('counts an ask from its arrival: a drain waits for it, takes no new one, and ends once it is answered', async () => {
    let finish: (answer: KeptAnswer) => void = () => undefined;
    const door = keeperServer({
      routes: {
        '/measure': measuring(
          () =>
            new Promise(resolve => {
              finish = resolve;
            })
        )
      },
      askMs: 5000,
      bodyBytes: 1024
    });
    const port = await door.listen();
    const taken = post(port, asked);
    await until(() => door.inFlight() === 1);
    const drained = door.drain(5000);

    // Taking none from now on: a new ask finds the door closed.
    expect(await post(port, asked)).toHaveProperty('error');
    finish({ readings: [{ problem: 'h1 read' }] });

    expect(await taken).toEqual({ status: 200, body: { readings: [{ problem: 'h1 read' }] } });
    expect(await drained).toBe(true);
    expect(door.inFlight()).toBe(0);
  });

  it('answers an ask past its time as too slow, for its caller to read the page as before', async () => {
    const door = keeperServer({
      routes: { '/measure': () => new Promise(() => undefined) },
      askMs: 30,
      bodyBytes: 1024
    });
    const port = await door.listen();

    expect(await post(port, asked)).toEqual({ status: 200, body: { problem: 'the kept browser took too long' } });
    await door.drain(0);
  });
});
