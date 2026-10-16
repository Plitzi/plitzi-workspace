import { use } from 'react';

import { sharedContext } from '@plitzi/sdk-shared/helpers';

import type { NotificationOptions } from '@plitzi/sdk-shared/authoring';

/** Shows a notification on the page, as the space's `addNotification` step does. */
export type Notify = (content: string, options?: NotificationOptions) => void;

/** Nothing renders a space here — a plugin drawn on its own: said, rather than a notification that never shows. */
const outsideSpace: Notify = content => {
  console.warn(`[plitzi] useNotify: no space is rendered around this element, so "${content}" was not shown`);
};

// Shared: a plugin is a bundle of its own, and reads the page's provider through whichever copy of the SDK it imported.
export const NotifyContext = sharedContext<Notify>('NotifyContext', outsideSpace);

/**
 * The page's notifications, for a plugin: `notify('Deleted 79 recordings')` shows what an `addNotification` step
 * shows — the same toasts, in the space's theme and with the look its `notifications` give them — with no event, flow
 * or step of the space's to wire. `{ appearance: 'danger' }` and the rest take the step's defaults when left out.
 *
 * What the PAGE decides to say stays a flow (`on(…)` → `addNotification`); this is for what only the plugin knows.
 */
const useNotify = (): Notify => use(NotifyContext);

export default useNotify;
