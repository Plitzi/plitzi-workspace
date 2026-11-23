/** Static declaration for Disclosure: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { DisclosureProps } from './Disclosure';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type DisclosureAttributes = AuthorableAttributes<DisclosureProps>;

const declaration = elementDeclaration<DisclosureAttributes>()({
  type: 'disclosure',
  callbacks: {
    openDisclosure: { action: 'openDisclosure', title: 'Open Disclosure', type: 'callback', params: {}, preview: {} },
    closeDisclosure: {
      action: 'closeDisclosure',
      title: 'Close Disclosure',
      type: 'callback',
      params: {},
      preview: {}
    },
    toggleDisclosure: {
      action: 'toggleDisclosure',
      title: 'Toggle Disclosure',
      type: 'callback',
      params: {},
      preview: {}
    }
  },
  marks: {
    '[open]': 'on the disclosure while what it holds is shown',
    'its summary':
      'lights a class’s `expanded` state while the disclosure is open — a sign inside it turns with the parent’s (`ancestors: { ">": { states: { expanded: … } } }`)'
  },
  content: {
    attributes: { open: false, name: '', closeOnClickOutside: false, closeOnNavigate: true },
    definition: {
      label: 'Disclosure',
      description:
        'A summary that shows or hides what follows it: a question and its answer, a menu, "show more", a panel of ' +
        'filters. Its first child is its `disclosureSummary` — what is pressed — and the rest is what it shows. `open` ' +
        'starts it open; disclosures with the same `name` are an accordion, one open at a time. Escape closes it; ' +
        '`closeOnClickOutside` closes it on a press anywhere else (a menu), `closeOnNavigate` when the page changes (on by ' +
        'default — a menu in a layout). It is a `<details>`: it opens before the page’s script runs, the browser’s ' +
        'find-in-page opens the one holding what was found, and what is closed is still in the page for search engines.',
      items: []
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-caret-down'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  },
  initialItems: ['disclosureSummary']
});

export default declaration;
