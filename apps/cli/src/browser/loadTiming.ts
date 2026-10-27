import type { BrowserPage } from './index';

/**
 * When a page's document was in and when it had loaded, in ms from its navigation: `load` absent while something holds
 * it — a script `--hold` keeps unanswered. A scout read whether a third-party script held a page's load by hand.
 */
export interface LoadTiming {
  contentLoaded?: number;
  load?: number;
}

/** Run in the page: its navigation's two moments, those that came. */
const timingOf = (): LoadTiming => {
  const navigation = performance.getEntriesByType('navigation').at(0);
  const at = (name: string): number | undefined => {
    const value: unknown = navigation ? Reflect.get(navigation, name) : undefined;

    return typeof value === 'number' && value > 0 ? Math.round(value) : undefined;
  };
  const contentLoaded = at('domContentLoadedEventEnd');
  const load = at('loadEventEnd');

  return { ...(contentLoaded === undefined ? {} : { contentLoaded }), ...(load === undefined ? {} : { load }) };
};

export const loadTiming = (page: BrowserPage): Promise<LoadTiming> => page.evaluate(timingOf, undefined);

const msText = (ms: number): string => (ms < 1000 ? `${String(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

/** The two moments said, and the one that had not come by the time it was read. */
export const loadTimingText = (timing: LoadTiming): string =>
  [
    timing.contentLoaded === undefined
      ? 'its document was not in yet'
      : `its document in at ${msText(timing.contentLoaded)}`,
    timing.load === undefined ? 'its load had not come when the steps ended' : `loaded at ${msText(timing.load)}`
  ].join(', ');
