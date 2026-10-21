import { describe, expect, it } from 'vitest';

import { readPage } from './capture';

import type { BrowserPage } from '../../browser';

/** A page whose reads fail as a reload's do, `times` times, then answer. */
const reloading = (times: number): Pick<BrowserPage, 'evaluate' | 'waitForLoadState' | 'url'> & { loads: number } => {
  let left = times;
  const page = {
    loads: 0,
    url: () => 'http://127.0.0.1:8300/',
    waitForLoadState: () => {
      page.loads += 1;

      return Promise.resolve();
    },
    evaluate: <R, A>(read: (input: A) => R | Promise<R>, input: A): Promise<R> => {
      if (left > 0) {
        left -= 1;

        return Promise.reject(
          new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation')
        );
      }

      return Promise.resolve(read(input));
    }
  };

  return page;
};

// velada-dress: a run's preview reloads at each approval, and `page shot --compare` died reading it.
describe('reading a page that reloads under it', () => {
  it('reads it again once it has loaded', async () => {
    const page = reloading(1);
    expect(await readPage(page, (n: number) => n * 2, 21)).toBe(42);
    expect(page.loads).toBe(1);
  });

  it('refuses, saying why, a page that keeps reloading', async () => {
    await expect(readPage(reloading(2), (n: number) => n, 1)).rejects.toThrow(
      'The page kept reloading while it was read'
    );
  });
});
