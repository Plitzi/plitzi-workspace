import { authorSpace, button, delay, onClick, setState, singlePageSpace, text, when } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * Flows whose steps read what changed after the trigger fired.
 *
 * Each step reads the page as it is when it runs: what an earlier step of the same flow wrote, a computed value over
 * it, and what somebody did while the flow waited. Three buttons, one text each — the spec presses and reads.
 */

export const FLOW_READS_IDS = {
  page: 'reads-page',
  write: 'reads-write',
  written: 'reads-written',
  compute: 'reads-compute',
  computed: 'reads-computed',
  start: 'reads-start',
  cancel: 'reads-cancel',
  outcome: 'reads-outcome'
};

/** How long the waiting flow waits: long enough for a click to land in the middle of it. */
export const FLOW_READS_WAIT_MS = 1500;

const shows = (id: string, key: string) => text('none', { id, bind: { content: `state.${key}` } });

export const flowReadsSpace = (): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        button({
          id: FLOW_READS_IDS.write,
          content: 'Write, then read',
          flows: [
            [
              onClick(),
              setState({ key: 'count', type: 'text', value: 'written' }),
              setState({ key: 'echo', type: 'text', value: '{{ state.count }}' })
            ]
          ]
        }),
        shows(FLOW_READS_IDS.written, 'echo'),
        button({
          id: FLOW_READS_IDS.compute,
          content: 'Write, then read a computed value',
          flows: [
            [
              onClick(),
              setState({ key: 'n', type: 'number', value: 3 }),
              setState({ key: 'computedEcho', type: 'text', value: '{{ computed.doubled }}' })
            ]
          ]
        }),
        shows(FLOW_READS_IDS.computed, 'computedEcho'),
        button({
          id: FLOW_READS_IDS.start,
          content: 'Start',
          flows: [
            [
              onClick(),
              setState({ key: 'pending', type: 'text', value: 'yes' }),
              delay(FLOW_READS_WAIT_MS),
              when(
                { field: 'state.pending', operator: '=', value: 'yes' },
                setState({ key: 'outcome', type: 'text', value: 'ran' })
              )
            ]
          ]
        }),
        button({
          id: FLOW_READS_IDS.cancel,
          content: 'Cancel',
          flows: [[onClick(), setState({ key: 'pending', type: 'text', value: '' })]]
        }),
        shows(FLOW_READS_IDS.outcome, 'outcome')
      ],
      {
        name: 'reads',
        permanentUrl: 'reads',
        computed: { doubled: '{{ (state.n ?? 0) * 2 }}' },
        page: { id: FLOW_READS_IDS.page, name: 'Reads' }
      }
    )
  );
