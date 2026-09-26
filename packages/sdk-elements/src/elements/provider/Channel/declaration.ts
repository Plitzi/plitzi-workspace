/** Static declaration for Channel: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { ChannelProps } from './Channel';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ChannelAttributes = AuthorableAttributes<ChannelProps>;

const declaration = elementDeclaration<ChannelAttributes>()({
  type: 'channel',
  attributeValues: {
    subType: valuesOf<NonNullable<ChannelProps['subType']>>()(['', 'div', 'section', 'aside', 'main'])
  },
  sourceType: 'channel',
  triggers: {
    onMessage: {
      action: 'onMessage',
      title: 'On Message',
      type: 'trigger',
      params: {},
      preview: { type: '', data: '', from: '', user: '', at: '' }
    },
    onJoin: { action: 'onJoin', title: 'On Join', type: 'trigger', params: {}, preview: { from: '' } },
    onLeave: { action: 'onLeave', title: 'On Leave', type: 'trigger', params: {}, preview: { from: '' } }
  },
  callbacks: {
    publish: {
      action: 'publish',
      title: 'Publish',
      type: 'callback',
      preview: {},
      params: {
        type: { label: 'Type', defaultValue: '', type: 'text' },
        data: { label: 'Data (JSON or a template)', defaultValue: '', type: 'text' }
      }
    },
    setPresence: {
      action: 'setPresence',
      title: 'Set Presence',
      type: 'callback',
      preview: {},
      params: { data: { label: 'State (JSON or a template)', defaultValue: '', type: 'text' } }
    }
  },
  content: {
    attributes: {
      topic: '',
      keep: 20,
      subType: ''
    },
    definition: {
      label: 'Channel',
      type: 'channel',
      description:
        'A realtime channel: every page on the same `topic` hears what any of them publishes, within milliseconds. ' +
        'The topic must match a channel the space declares in its settings (`channels`), e.g. `board:{{ id }}` ' +
        'under `board:{id}`. ITS DESCENDANTS bind to its source `channel_<id>`: `connected`, `members` (with the ' +
        'state each announced), `messages` (the last `keep`) and `last`. It fires `onMessage`, `onJoin` and ' +
        '`onLeave`, and answers `publish({ type, data })` and `setPresence({ data })`; `presence` is the state this ' +
        'page announces (a name, a colour). Closed in the builder and anywhere without a server.',
      items: [],
      bindings: {},
      styleSelectors: { base: '' },
      initialState: { visibility: true }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'provider',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-tower-broadcast'
    },
    defaultStyle: {
      name: 'Channel',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
