import { createStoreHook } from '@plitzi/sdk-store';

export type Quote = { id: number; text: string; author: string };
export type AsyncDemoState = { quote: Quote | null };

export const ASYNC_INITIAL: AsyncDemoState = { quote: null };

const QUOTES: Quote[] = [
  { id: 1, text: 'Premature optimization is the root of all evil.', author: 'Donald Knuth' },
  { id: 2, text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { id: 3, text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
  { id: 4, text: 'Simplicity is a prerequisite for reliability.', author: 'Edsger Dijkstra' }
];

let cursor = 0;

// Stand-in API: ~800ms latency, with an optional failure to exercise the error path.
export const fetchQuote = (shouldFail: boolean): Promise<Quote> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('502 Bad Gateway'));

        return;
      }

      cursor = (cursor + 1) % QUOTES.length;
      resolve(QUOTES[cursor]);
    }, 800);
  });

export const { useStore: useAsyncDemoStore } = createStoreHook<AsyncDemoState>();
