import { authorSpace, button, onClick, setState, singlePageSpace, text } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * A page an agent keeps improving: each version says which it is, beside a button that writes the page's state and a
 * text showing it. The spec hands an open page the next version — what the person did there must still be there.
 */

export const LIVE_IDS = { version: 'live-version', press: 'live-press', pressed: 'live-pressed' };

export const liveSpace = (version: number): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        text(`Version ${String(version)}`, { id: LIVE_IDS.version }),
        button({
          id: LIVE_IDS.press,
          content: 'Press',
          flows: [[onClick(), setState({ key: 'pressed', type: 'text', value: 'pressed before the update' })]]
        }),
        text('not pressed', { id: LIVE_IDS.pressed, bind: { content: 'state.pressed' } })
      ],
      { name: 'live', permanentUrl: 'live', page: { id: 'live-page', name: 'Live' } }
    )
  );
