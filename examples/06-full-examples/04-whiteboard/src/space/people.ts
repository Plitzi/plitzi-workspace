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
import { BOARD_PROVIDER } from './ids.ts';
import { BELOW_HEADER, BUTTON_RESET, FLOAT, caption } from './kit.ts';
import { closeOthers } from './panels.ts';
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
  // Room for the first avatar's overlap, which the others' negative margins make.
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
              // An agent is a star — a person, their initial.
              bindTemplate('content', 'people.item.state', "{{ source.agent ? '✦' : source.name|first|upper }}"),
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
    flows: [[onClick(), ...closeOthers('meOpen'), toggleState({ key: 'meOpen' })]]
  });

const popover = styles('popover', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: BELOW_HEADER,
      right: '14px',
      'z-index': '6',
      width: '284px',
      // Scrolls rather than run off a short screen: the code alone is most of its height.
      'max-height': 'calc(100dvh - 90px)',
      'overflow-y': 'auto',
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

const switchRow = styles('switchRow', {
  css: {
    ...BUTTON_RESET,
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    gap: '10px',
    width: '100%',
    'font-size': '13px',
    color: 'var(--ink)',
    'text-align': 'left'
  },
  states: { 'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px', 'border-radius': '6px' } }
});

/** A switch: its track in the accent when on, and its knob at that end. */
const track = styles('switchTrack', {
  css: {
    position: 'relative',
    display: 'block',
    width: '34px',
    height: '20px',
    'flex-shrink': '0',
    'border-radius': '999px',
    'background-color': 'var(--edge)',
    transition: 'background-color 140ms ease'
  },
  variants: { on: { 'background-color': 'var(--accent)' } }
});

const knob = styles('switchKnob', {
  css: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '14px',
    height: '14px',
    'border-radius': '50%',
    'background-color': '#ffffff',
    'box-shadow': '0 1px 2px rgba(0, 0, 0, 0.3)',
    transition: 'transform 140ms ease'
  },
  variants: { on: { transform: 'translateX(14px)' } }
});

/** On or off, for this person's own screen — kept across visits, like their name. */
const preference = (id: string, label: string, key: string): ElementSpec =>
  button({
    id,
    content: '',
    title: label,
    class: switchRow,
    flows: [[onClick(), setState({ key, type: 'boolean', value: `{{ not computed.${key} }}` })]],
    children: [
      text({ content: label }),
      container({
        class: track,
        bind: [variantFrom(track, `computed.${key}`, { template: "{{ source ? 'on' : '' }}" })],
        children: [
          text({
            content: '',
            class: knob,
            bind: [variantFrom(knob, `computed.${key}`, { template: "{{ source ? 'on' : '' }}" })]
          })
        ]
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
      container({ class: swatches, children: COLLAB_COLOURS.map(colourChoice) }),
      text({ content: 'On your screen', class: caption }),
      preference('show-authors', 'Show who wrote notes and cards', 'showAuthors'),
      preference('sounds', 'Sounds — arrivals, chat, reactions, the timer', 'sounds')
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
        class: popoverNote,
        // Read-only, the link is to look around together: saying "draw" would promise what the board refuses.
        bind: [
          bindTemplate(
            'content',
            BOARD_PROVIDER,
            "{{ source.readOnly ? 'Anyone with the link can look around, point and react — no account. Only whoever made it can draw.' : 'Anyone with the link can draw on this board — no account. Scan it with a phone to draw from there.' }}"
          )
        ]
      }),
      shareCard({
        id: 'share-card',
        class: shareCardClass,
        flows: [
          [
            declaredTrigger(shareDeclaration, 'onCopied'),
            boardAction('chime', { sound: 'copy' }),
            addNotification({
              content: 'Link copied',
              appearance: 'success',
              placement: 'bottom-center',
              autoDismissTimeout: 2000
            })
          ]
        ]
      })
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

/** The people and Share: solid shapes, grouped, with room between them and around them. */
const peopleGroup = styles('peopleGroup', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  margin: '0px 6px 0px 4px'
});

export const presence = (): ElementSpec =>
  container({
    class: peopleGroup,
    children: [
      others(),
      me(),
      button({
        id: 'share',
        content: 'Share',
        class: shareButton,
        flows: [[onClick(), ...closeOthers('shareOpen'), toggleState({ key: 'shareOpen' })]]
      })
    ]
  });

export const popovers = (): ElementSpec[] => [mePanel(), sharePanel()];
