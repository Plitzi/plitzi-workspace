import { COUNTDOWN_TYPE } from './countdown';
import { TIME_WINDOW_TYPE } from './timeWindows';
import { templatePaths } from '../helpers/twigWrapper';

import type { Schema } from '../types';

/** The types that show or say something by the time. */
const CLOCK_TYPES: ReadonlySet<string> = new Set([TIME_WINDOW_TYPE, COUNTDOWN_TYPE]);

/** Whether a path is the page's clock: `time`, `time.now`, `time.today`. */
const isClockPath = (path: string): boolean => path === 'time' || path.startsWith('time.');

/**
 * Whether a value reads the page's clock, wherever in it: a template that names `time.*` or tells the time by it
 * (`ago`), or a binding whose source is it. Walked to the end — an element's attributes, its bindings, its flows.
 */
const readsClockIn = (value: unknown): boolean => {
  if (typeof value === 'string') {
    if (isClockPath(value)) {
      return true;
    }

    return (value.includes('{{') || value.includes('{%')) && templatePaths(value).some(isClockPath);
  }

  if (Array.isArray(value)) {
    return value.some(readsClockIn);
  }

  return typeof value === 'object' && value !== null && Object.values(value).some(readsClockIn);
};

type SpaceTrees = Pick<Schema, 'flat'> &
  Partial<Pick<Schema, 'components'>> & { settings?: Partial<Pick<Schema['settings'], 'computed'>> };

/**
 * Whether a space shows or says anything by the time — a time window, a countdown, a template that reads the page's
 * clock (`time.*`, `ago`), on its pages, in its components or its computed values: its pages are then drawn at an
 * instant the browser hydrates at, and say on the server what they say in the browser.
 */
export const readsTheClock = (schema: SpaceTrees): boolean =>
  [schema.flat, ...Object.values(schema.components ?? {}).map(component => component.flat)].some(flat =>
    Object.values(flat).some(
      element =>
        CLOCK_TYPES.has(element.definition.type) || readsClockIn(element.attributes) || readsClockIn(element.definition)
    )
  ) || readsClockIn(schema.settings?.computed);
