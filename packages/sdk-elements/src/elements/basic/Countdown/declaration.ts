/** Static declaration for Countdown: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring';
import { COUNTDOWN_LABELS, COUNTDOWN_TYPE, COUNTDOWN_UNITS } from '@plitzi/sdk-shared/timeWindows';

import type { CountdownProps } from './Countdown';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';
import type { CountdownLabels, CountdownUnit } from '@plitzi/sdk-shared/timeWindows';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type CountdownAttributes = AuthorableAttributes<CountdownProps>;

const declaration = elementDeclaration<CountdownAttributes>()({
  type: COUNTDOWN_TYPE,
  attributeValues: {
    largest: valuesOf<CountdownUnit>()(COUNTDOWN_UNITS),
    smallest: valuesOf<CountdownUnit>()(COUNTDOWN_UNITS),
    labels: valuesOf<CountdownLabels>()(COUNTDOWN_LABELS)
  },
  triggers: {
    onCountdownEnd: { action: 'onCountdownEnd', title: 'On Countdown End', type: 'trigger', params: {}, preview: {} }
  },
  content: {
    attributes: { to: '', largest: 'days', smallest: 'seconds', labels: 'long', locale: '' },
    definition: {
      label: 'Countdown',
      description:
        'How long is left until an instant — a launch, the end of a sale, an event: `to`, ISO 8601 with the offset ' +
        '(`2026-12-01T09:00:00Z`), or left empty inside a `timeWindow` to count to its `endsAt`. It says each unit from ' +
        '`largest` down to `smallest` (days to seconds by default), named in the page’s language (`labels`: long, short ' +
        'or none; `locale` for another than the space’s). The server draws it at the instant it renders and the page ' +
        'counts on; at zero it stays at zero and `onCountdownEnd` runs a flow — reveal what was waiting, or put a ' +
        '`timeWindow` around it to hide it. Each unit is a slot (`unit`, with its `value` and `label`) to style.',
      items: [],
      styleSelectors: { unit: '', value: '', label: '' }
    },
    market: {
      category: 'basic',
      icon: 'fa-solid fa-hourglass-half'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'inline-flex',
            'flex-wrap': 'wrap',
            gap: '0.5em',
            'font-variant-numeric': 'tabular-nums'
          }
        },
        unit: {
          default: {
            display: 'inline-flex',
            'align-items': 'baseline',
            gap: '0.25em'
          }
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
