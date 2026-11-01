import { sayer } from './types';
import { browserInUse } from '../commands/browser/browser';

import type { Check } from './types';

const say = sayer('browser');

/**
 * The browser the page commands open pages in — `plitzi page check`, `shot`, `test`, a run's checks — said so it is
 * known which; none is a warning, not an error: the project installs, builds and goes up without one.
 */
export const checkBrowser: Check = async () => {
  const inUse = await browserInUse();

  return 'problem' in inUse
    ? [say.warning('browser-none', inUse.problem, { fix: 'plitzi browser install' })]
    : [say.info('browser-in-use', `Pages open in ${inUse.said}.`)];
};
