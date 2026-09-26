import {
  authorSpace,
  bindTemplate,
  button,
  container,
  onClick,
  onKey,
  setState,
  singlePageSpace,
  text
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * A page for counting renders: a counter and the button that moves it, a row of labels that read nothing, and a row
 * that reads one computed LIST — which is evaluated again whenever any state changes, and must not carry its readers
 * with it when it comes out the same.
 */

export const RENDERS_IDS = {
  page: 'renders-page',
  count: 'renders-count',
  bump: 'renders-bump',
  picked: 'renders-picked',
  other: 'renders-other'
};

/** How many labels read nothing, and how many read the computed list. */
export const RENDERS_ROW = 12;

export const rendersSpace = (): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        container({
          id: 'renders-host',
          flows: [[onKey('mod+k'), setState({ key: 'other', type: 'text', value: 'pressed' })]],
          children: [
            text('0', { id: RENDERS_IDS.count, bind: { content: 'state.count' } }),
            button({
              id: RENDERS_IDS.bump,
              content: 'Bump',
              flows: [[onClick(), setState({ key: 'count', type: 'number', value: '{{ (state.count ?? 0) + 1 }}' })]]
            }),
            text('', { id: RENDERS_IDS.other, bind: { content: 'state.other' } }),
            container({
              id: 'renders-still',
              children: Array.from({ length: RENDERS_ROW }, (_, index) =>
                text(`still ${index}`, { id: `renders-still-${index}` })
              )
            }),
            container({
              id: 'renders-readers',
              children: Array.from({ length: RENDERS_ROW }, (_, index) =>
                text('', {
                  id: `${RENDERS_IDS.picked}-${index}`,
                  bind: [bindTemplate('content', 'computed.picked', '{{ source|join(", ") }}')]
                })
              )
            })
          ]
        })
      ],
      {
        name: 'renders',
        permanentUrl: 'renders',
        computed: { picked: '{{ ["b", "a"]|sort }}' },
        page: { id: RENDERS_IDS.page, name: 'Renders' }
      }
    )
  );
