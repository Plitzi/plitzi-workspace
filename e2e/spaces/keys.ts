import { authorSpace, container, formControl, onKey, setState, singlePageSpace, text } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * Keyboard shortcuts: two flows on one element, and a field to type in.
 *
 * `+` (or `=`) writes one value and Escape another; the spec presses them on the page and inside the field, where
 * only Escape counts.
 */

export const KEYS_IDS = {
  page: 'keys-page',
  host: 'keys-host',
  shown: 'keys-shown',
  field: 'keys-field'
};

export const keysSpace = (): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        container({
          id: KEYS_IDS.host,
          flows: [
            [onKey('plus, ='), setState({ key: 'zoom', type: 'text', value: 'in' })],
            [onKey('escape'), setState({ key: 'zoom', type: 'text', value: 'reset' })]
          ],
          children: [text('none', { id: KEYS_IDS.shown, bind: { content: 'state.zoom' } })]
        }),
        formControl({ id: KEYS_IDS.field, name: 'note', label: 'Note' })
      ],
      { name: 'keys', permanentUrl: 'keys', page: { id: KEYS_IDS.page, name: 'Keys' } }
    )
  );
