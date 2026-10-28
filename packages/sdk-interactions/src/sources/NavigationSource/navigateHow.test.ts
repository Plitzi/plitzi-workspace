import { describe, expect, it } from 'vitest';

import { navigationCallbacks } from './callbacks';
import { navigateHow } from './navigateHow';

// A sheet opened by `?stats=1` and closed with a navigate step was reopened by Back: the step could only push.
describe('how a navigate step goes', () => {
  it('takes the place of the address it is on when asked, and leaves the space only for a whole address', () => {
    expect(navigateHow({ urlType: 'internal', replace: true })).toEqual({ external: false, replace: true });
    expect(navigateHow({ urlType: 'page' })).toEqual({ external: false, replace: false });
    expect(navigateHow({ urlType: 'external' })).toEqual({ external: true, replace: false });
    expect(navigationCallbacks.navigate.params.replace).toMatchObject({ type: 'boolean', default: false });
  });
});
