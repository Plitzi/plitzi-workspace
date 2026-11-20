/** Static declaration for TimeWindow: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';
import { TIME_WINDOW_TYPE } from '@plitzi/sdk-shared/timeWindows';

import type { TimeWindowProps } from './TimeWindow';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TimeWindowAttributes = AuthorableAttributes<TimeWindowProps>;

const declaration = elementDeclaration<TimeWindowAttributes>()({
  type: TIME_WINDOW_TYPE,
  content: {
    attributes: { startsAt: '', endsAt: '' },
    definition: {
      label: 'Time Window',
      description:
        'Shows what it holds only between two instants — a sale, an event, a banner for a week: `startsAt` and `endsAt`, ' +
        'ISO 8601 with the offset (`2026-12-01T09:00:00Z`); either left empty is no bound. The server draws it at the ' +
        'instant it renders; an open page shows or hides it when the window opens or closes. Not access control: what ' +
        'it holds is in the space’s document, as anything a flag hides.',
      items: []
    },
    market: {
      category: 'structure',
      icon: 'fa-regular fa-calendar'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  }
});

export default declaration;
