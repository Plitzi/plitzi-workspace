import { TOPICS } from '../actions.ts';
import { BOARD_DECLARATION, boardPage } from './board.ts';
import { customCss } from './css.ts';
import { galleryPage } from './home/index.ts';
import { SHARE_DECLARATION } from './people.ts';
import { computed, transientState } from './state.ts';
import { COUNTDOWN_DECLARATION } from './timer.ts';
import { STACK_DECLARATION } from './tray.ts';
import { fonts, notifications, variables } from './tokens.ts';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

/** The components this space ships, as their declarations: `main.ts` hands them to `authorSpace`, which checks them. */
export const PLUGINS = [BOARD_DECLARATION, SHARE_DECLARATION, STACK_DECLARATION, COUNTDOWN_DECLARATION];

/**
 * Pizarra, declared: two pages, five server actions, three channels and two elements of its own.
 *
 * Element ids, class names and flow chains are derived from what is written here, so authoring it twice writes
 * byte-identical documents, and the space opens in the builder exactly as it reads.
 */
export const space: SpaceSpec = {
  name: 'Pizarra',
  permanentUrl: 'pizarra',
  // Both pages are read on the server into the first paint.
  rsc: { enabled: true },
  theme: { default: 'system', schemes: ['light', 'dark'] },
  fonts,
  variables,
  notifications,
  computed,
  customCss,
  settings: { keepState: true, stateStorage: 'localStorage', transientState },
  /**
   * The realtime channels the pages may open. A topic nothing here matches is refused by the server — and by
   * `authorSpace`, before it ever is.
   */
  channels: {
    // What was saved: said only by the server, after `board-apply` validated and kept it.
    [TOPICS.board]: { access: { mode: 'public' }, publish: 'server' },
    /**
     * Who is here and what they are doing: pages speak directly. A pointer message carries a cursor and, while
     * something is dragged, the dragged elements — hence the room to spare over the defaults.
     */
    [TOPICS.room]: {
      access: { mode: 'public' },
      publish: 'clients',
      presence: true,
      maxMessageBytes: 8192,
      messagesPerSecond: 40
    },
    [TOPICS.boards]: { access: { mode: 'public' }, publish: 'server' },
    // Who is on the front page right now: presence only, nothing said.
    [TOPICS.lobby]: { access: { mode: 'public' }, publish: 'clients', presence: true, messagesPerSecond: 5 }
  },
  pages: [galleryPage, boardPage]
};
