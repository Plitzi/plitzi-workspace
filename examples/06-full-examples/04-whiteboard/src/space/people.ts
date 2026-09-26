import {
  addNotification,
  bindTemplate,
  button,
  container,
  declaredTrigger,
  defineElement,
  formControl,
  list,
  named,
  on,
  onClick,
  setState,
  styles,
  text,
  toggleState,
  variantFrom
} from '@plitzi/sdk-authoring';

import { COLLAB_COLOURS } from '../board/people.ts';
import shareDeclaration from '../plugins/ShareCard/declaration.ts';
import { BUTTON_RESET, FLOAT, caption } from './kit.ts';
import { editOnly, passwordSection } from './access.ts';
import { boardAction } from './stylePanel.ts';

import type { ShareCardAttributes } from '../plugins/ShareCard/declaration.ts';
import type { CssProps, ElementSpec } from '@plitzi/sdk-authoring';

/**
 * Who is on the board: the room's members as avatars, this person's own name and colour, and the way to invite more.
 *
 * The avatars are the `room` channel's source — `members`, each with the state it announced — bound to a list like
 * any other array. Nothing here stores who is present: the room keeps it, from what the members say.
 */

const shareCard = defineElement<ShareCardAttributes>(shareDeclaration);

export const SHARE_DECLARATION = shareDeclaration;

const AVATAR: CssProps = {
  ...BUTTON_RESET,
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '32px',
  height: '32px',
  'border-radius': '50%',
  border: '2px solid var(--surface)',
  'font-size': '13px',
  'font-weight': '700',
  color: '#ffffff',
  'flex-shrink': '0',
  'background-color': 'var(--muted)'
};

/** One colour per person: a variant each, so the avatar, the cursor and the outline share the name. */
const colourVariants = Object.fromEntries(
  COLLAB_COLOURS.map(colour => [colour, { 'background-color': `var(--collab-${colour})` }])
);

const avatar = styles('avatar', {
  css: { ...AVATAR, 'margin-left': '-6px' },
  states: {
    hover: { 'box-shadow': '0 0 0 2px var(--accent)', 'z-index': '1' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  },
  variants: colourVariants
});

const meAvatar = styles('meAvatar', {
  css: AVATAR,
  states: {
    hover: { 'box-shadow': '0 0 0 2px var(--accent)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  },
  variants: colourVariants
});

const peopleRow = styles('people', {
  display: 'flex',
  'align-items': 'center',
  'padding-left': '6px',
  margin: '0px',
  'list-style-type': 'none'
});

const avatarItem = styles('avatarItem', { display: 'flex' });

/** The others on the room. This page is not among them: it is the chip beside them, which opens its own panel. */
const others = (): ElementSpec =>
  list({
    id: 'people',
    source: 'controlled',
    class: peopleRow,
    bind: [
      bindTemplate(
        'items',
        'room.members',
        '{{ source|filter(member => not member.me and member.state.name is defined) }}',
        {
          returns: 'value'
        }
      )
    ],
    children: [
      container({
        subType: 'li',
        class: avatarItem,
        children: [
          // A click follows them: this page shows what they show until the person here touches the board.
          button({
            content: '',
            title: 'Follow — see what they see',
            class: avatar,
            bind: [
              bindTemplate('content', 'people.item.state.name', '{{ source|first|upper }}'),
              variantFrom(avatar, 'people.item.state.color')
            ],
            flows: [[onClick(), boardAction('follow', { from: '{{ list_people.item.from }}' })]]
          })
        ]
      })
    ]
  });

const me = (): ElementSpec =>
  button({
    id: 'me',
    content: '',
    title: 'You — change your name and colour',
    class: meAvatar,
    bind: [
      bindTemplate('content', 'computed.name', '{{ source|first|upper }}'),
      variantFrom(meAvatar, 'computed.color')
    ],
    flows: [[onClick(), setState({ key: 'shareOpen', type: 'boolean', value: false }), toggleState({ key: 'meOpen' })]]
  });

const popover = styles('popover', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: '58px',
      right: '14px',
      'z-index': '6',
      width: '284px',
      padding: '14px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '12px'
    },
    mobile: { right: '10px', left: '10px', width: 'auto' }
  }
});

const popoverTitle = styles('popoverTitle', { 'font-size': '14px', 'font-weight': '600', color: 'var(--ink)' });

const popoverNote = styles('popoverNote', { 'font-size': '12px', color: 'var(--muted)', 'line-height': '1.45' });

const nameField = styles('nameField', { width: '100%' });

/**
 * The field's box, on the form control's `input` slot — the container the SDK draws a box on. Styled there, and the
 * `<input>` inside left bare (`css.ts`): a border on each is two boxes.
 */
const nameInput = styles('nameInput', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '36px',
    padding: '0px 10px',
    border: '1px solid var(--edge)',
    'border-radius': '8px',
    'background-color': 'var(--surface-2)'
  },
  states: { 'focus-within': { 'border-color': 'var(--accent)', 'background-color': 'var(--surface)' } }
});

const swatches = styles('colourRow', { display: 'flex', 'flex-wrap': 'wrap', gap: '8px' });

/** A class per colour, as the style panel's swatches are: the colour IS the button, not a state of it. */
const colourSwatch = (colour: string) =>
  styles(`colourSwatch-${colour}`, {
    css: {
      ...AVATAR,
      width: '26px',
      height: '26px',
      border: '0px solid transparent',
      'background-color': `var(--collab-${colour})`
    },
    states: {
      hover: { transform: 'scale(1.1)' },
      'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
    }
  });

const chosenMark = styles('chosenMark', { 'font-size': '12px', 'pointer-events': 'none' });

const colourChoice = (colour: string): ElementSpec =>
  button({
    id: `colour-${colour}`,
    content: '',
    title: colour,
    class: colourSwatch(colour),
    flows: [[onClick(), setState({ key: 'color', type: 'text', value: colour })]],
    children: [
      text({
        content: '✓',
        class: chosenMark,
        visible: { source: 'computed.color', template: `{{ source == '${colour}' ? 'true' : 'false' }}` }
      })
    ]
  });

const mePanel = (): ElementSpec =>
  container({
    id: 'me-panel',
    class: popover,
    visible: 'computed.meOpen',
    children: [
      text({ content: 'You, on this board', class: popoverTitle }),
      text({ content: 'Your name', class: caption }),
      formControl({
        id: 'my-name',
        name: 'name',
        label: '',
        placeholder: 'A name the others will see',
        required: false,
        autoComplete: false,
        class: nameField,
        slots: { input: nameInput },
        bind: { defaultValue: 'computed.name' },
        // Every keystroke: the others see the name change on the cursor as it is typed.
        flows: [
          [
            named('typed', on('onChange')),
            setState({ key: 'name', type: 'text', value: '{{ typed.value|trim|slice(0, 24) }}' })
          ]
        ]
      }),
      text({ content: 'Your colour', class: caption }),
      container({ class: swatches, children: COLLAB_COLOURS.map(colourChoice) })
    ]
  });

const sharePanel = (): ElementSpec =>
  container({
    id: 'share-panel',
    class: popover,
    visible: 'computed.shareOpen',
    children: [
      text({ content: 'Invite people', class: popoverTitle }),
      text({
        content: 'Anyone with the link can draw on this board — no account. Scan it with a phone to draw from there.',
        class: popoverNote
      }),
      shareCard({
        id: 'share-card',
        class: shareCardClass,
        flows: [
          [
            declaredTrigger(shareDeclaration, 'onCopied'),
            addNotification({
              content: 'Link copied',
              appearance: 'success',
              placement: 'bottom-center',
              autoDismissTimeout: 2000
            })
          ]
        ]
      }),
      // Who may get in: anyone with the link, or only whoever also has the password. A read-only board has no say.
      editOnly(passwordSection())
    ]
  });

/** The card's class — and, in `css.ts`, where its `--share-*` colours are set. */
const shareCardClass = styles('shareCard', { color: 'var(--ink)' });

const shareButton = styles('shareButton', {
  css: {
    ...BUTTON_RESET,
    height: '32px',
    padding: '0px 14px',
    'border-radius': '8px',
    'font-weight': '600',
    'font-size': '13px',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: {
    hover: { filter: 'brightness(1.08)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

export const presence = (): ElementSpec[] => [
  others(),
  me(),
  button({
    id: 'share',
    content: 'Share',
    class: shareButton,
    flows: [[onClick(), setState({ key: 'meOpen', type: 'boolean', value: false }), toggleState({ key: 'shareOpen' })]]
  })
];

export const popovers = (): ElementSpec[] => [mePanel(), sharePanel()];
