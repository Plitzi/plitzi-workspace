import { authorSpace, button, onClick, setState, singlePageSpace, text } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * A space that keeps its state across reloads — except one key it declares transient.
 *
 * Two buttons write two keys and two texts show them: `favourite` is what a person expects back after a reload,
 * `draft` is what must start fresh every visit. The spec reloads the browser in between, which is the only place the
 * difference exists.
 */

export const KEPT_IDS = {
  page: 'kept-page',
  keep: 'kept-keep',
  draft: 'kept-draft',
  keptText: 'kept-text',
  draftText: 'kept-draft-text'
};

export const KEPT_KEYS = { kept: 'favourite', transient: 'draft' };

/** A button that writes one state key. */
const writes = (id: string, content: string, key: string, value: string) =>
  button({ id, content, flows: [[onClick(), setState({ key, type: 'text', value })]] });

/** A text showing one state key, or `none` before anything was written. */
const shows = (id: string, key: string) => text('none', { id, bind: { content: `state.${key}` } });

export const keptStateSpace = (): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        writes(KEPT_IDS.keep, 'Save favourite', KEPT_KEYS.kept, 'saved'),
        writes(KEPT_IDS.draft, 'Type a draft', KEPT_KEYS.transient, 'typed'),
        shows(KEPT_IDS.keptText, KEPT_KEYS.kept),
        shows(KEPT_IDS.draftText, KEPT_KEYS.transient)
      ],
      {
        name: 'kept',
        permanentUrl: 'kept',
        settings: { keepState: true, stateStorage: 'localStorage', transientState: [KEPT_KEYS.transient] },
        page: { id: KEPT_IDS.page, name: 'Kept' }
      }
    )
  );
