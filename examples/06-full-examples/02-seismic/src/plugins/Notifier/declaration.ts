import type { NotifierProps } from './Notifier';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type NotifierAttributes = Omit<NotifierProps, 'className'>;

/**
 * The display's voice: desktop notifications, and a ping on the page.
 *
 * An element for the reason the full-screen button is one: what it does needs a person's gesture once. A browser
 * shows desktop notifications only for a site the person allowed, and asking is a click on THIS button. Once allowed
 * it is allowed for good — which is what a screen on a wall, that nobody touches, needs: every new event reaches the
 * operating system, and the system plays its sound.
 *
 * It never alerts by itself. The space calls `notify` and `chime` from its own flows, so when an event is news, and
 * whether it is heard, stay the page's decisions.
 */
const declaration = {
  type: 'notifier',
  triggers: {
    /** Where permission stands — read once the page is in a browser, and again whenever it changes. */
    onPermission: {
      action: 'onPermission',
      title: 'On Permission',
      type: 'trigger',
      params: {},
      preview: { permission: '' }
    }
  },
  callbacks: {
    notify: {
      action: 'notify',
      title: 'Desktop Notification',
      type: 'callback',
      params: {
        title: { label: 'Title', defaultValue: '', type: 'text' },
        body: { label: 'Body', defaultValue: '', type: 'text' },
        silent: { label: 'Silent (true | false)', defaultValue: 'false', type: 'text' },
        tag: { label: 'Tag (one alert per tag)', defaultValue: '', type: 'text' }
      }
    },
    chime: {
      action: 'chime',
      title: 'Chime',
      type: 'callback',
      params: { magnitude: { label: 'Magnitude (an alarm from 5)', defaultValue: '', type: 'text' } }
    }
  },
  content: {
    attributes: {
      enableLabel: 'Enable desktop alerts',
      onLabel: 'Desktop alerts on',
      blockedLabel: 'Alerts blocked by the browser'
    },
    definition: {
      label: 'Notifier',
      type: 'notifier',
      description:
        'A button that asks the browser, once, to allow desktop notifications — and the `notify` and `chime` actions ' +
        'a flow calls to alert. Its label says where permission stands. Not rendered where the browser has no ' +
        'notifications.',
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
      category: 'Controls',
      owner: 'Plitzi examples',
      license: 'MIT',
      website: '',
      backgroundColor: '#04090c',
      icon: 'fa-solid fa-bell'
    },
    defaultStyle: {
      name: 'Notifier',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'enableLabel', label: 'Label before permission' },
          { path: 'onLabel', label: 'Label once allowed' },
          { path: 'blockedLabel', label: 'Label when blocked' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<NotifierAttributes>;

export default declaration;
