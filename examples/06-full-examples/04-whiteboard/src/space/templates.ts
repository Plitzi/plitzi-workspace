import {
  addNotification,
  bindTemplate,
  button,
  container,
  declaredTrigger,
  defineElement,
  form,
  formControl,
  list,
  named,
  onClick,
  onPointerDown,
  onSubmit,
  resetForm,
  runServerAction,
  setState,
  styles,
  text,
  when,
  whenFailed,
  whileRunning
} from '@plitzi/sdk-authoring';

import { TEMPLATE_ADD_ACTION, TEMPLATE_REMOVE_ACTION, TEMPLATE_SAVE_ACTION } from '../actions.ts';
import { BOARD_PASS, ofBoard } from './access.ts';
import { COPY_DECLARATION, copyClass, copyText } from './copy.ts';
import { thumbCanvas } from './home/catalogue.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BUTTON_RESET, caption, icon } from './kit.ts';
import { closePanels } from './panels.ts';
import { boardAction } from './stylePanel.ts';
import declaration from '../plugins/Board/declaration.ts';

import type { BoardAttributes } from '../plugins/Board/declaration.ts';
import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The board's library of templates (`board/savedTemplates.ts`): what a team lays out every time — a retro's columns, a
 * check-in frame — kept once from the selection's tools, and put down again from the elements library as often as it
 * is needed, dragged or clicked. Each has a code: pasted into another board's library, it is on that board too.
 */

const THIS_BOARD = `{{ apiContainer_${BOARD_PROVIDER}.id }}`;

/**
 * In a binding over the board: its library as it is now — what the channel last said of THIS board's, or what the
 * board was read with.
 */
const LIBRARY = `(state.templatesHeard and state.templatesHeard.board == source.id ? state.templatesHeard.templates : (${ofBoard('templates', '[]')} ?? []))`;

export const TEMPLATES = `{{ ${LIBRARY} }}`;

/** Heard on the board's channel (`templates`): somebody saved, added or removed one — everyone's library follows. */
/** The library a template action answered with: what this page shows, without waiting for the channel to echo it. */
const keepLibrary = (step: string): StepSpec =>
  when(
    { field: `${step}.status`, operator: '=', value: 'completed' },
    setState({
      key: 'templatesHeard',
      type: 'json',
      value: `{{ { "board": ${step}.output.board, "templates": ${step}.output.templates }|json_encode }}`
    })
  );

export const hearTemplates = (heard: string): StepSpec =>
  when(
    { field: `${heard}.type`, operator: '=', value: 'templates' },
    setState({ key: 'templatesHeard', type: 'json', value: `{{ ${heard}.data }}` })
  );

const notice = (content: string, appearance: 'success' | 'danger'): StepSpec =>
  addNotification({ content, appearance, placement: 'bottom-center', autoDismissTimeout: 5000 });

/**
 * The canvas handed over a selection to keep (`saveTemplate`): kept by the server — one at a time — in the board's
 * library, and said where it is. Refused, the reason is said.
 */
export const templateSaveFlow: StepSpec[] = [
  whileRunning('queue', named('keeping', declaredTrigger(declaration, 'onTemplateSave'))),
  named(
    'kept',
    runServerAction({
      actionId: TEMPLATE_SAVE_ACTION,
      input: { board: THIS_BOARD, title: '{{ keeping.title }}', elements: '{{ keeping.elements }}', ...BOARD_PASS },
      invalidateQueries: 'none'
    })
  ),
  keepLibrary('kept'),
  when(
    { field: 'kept.status', operator: '=', value: 'completed' },
    notice(
      'Kept “{{ kept.output.template.title }}” as a template — it is in the library (＋), under Templates',
      'success'
    )
  ),
  whenFailed('kept', notice('{{ kept.error ? kept.error : "That could not be kept as a template" }}', 'danger'))
];

/** Keeps the selection as a template — beside what it is done to it, in the selection's tools. */
export const saveTemplateStep: StepSpec = boardAction('saveTemplate');

const thumbnail = defineElement<BoardAttributes>(declaration);

const section = styles('templatesSection', { display: 'flex', 'flex-direction': 'column', gap: '6px' });

const shelf = styles('templatesShelf', {
  display: 'grid',
  'grid-template-columns': 'repeat(2, minmax(0px, 1fr))',
  gap: '6px',
  margin: '0px',
  padding: '0px',
  'list-style-type': 'none'
});

const entry = styles('templateEntry', {
  display: 'flex',
  'flex-direction': 'column',
  'min-width': '0px',
  border: '1px solid var(--edge)',
  'border-radius': '10px',
  'background-color': 'var(--surface)',
  overflow: 'hidden'
});

const pick = styles('templatePick', {
  css: {
    ...BUTTON_RESET,
    display: 'flex',
    'flex-direction': 'column',
    gap: '6px',
    padding: '8px',
    'text-align': 'left',
    color: 'var(--ink)',
    cursor: 'grab',
    transition: 'background-color 140ms ease'
  },
  states: {
    hover: { 'background-color': 'var(--accent-soft)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '-2px' }
  }
});

const preview = styles('templatePreview', {
  position: 'relative',
  height: '64px',
  'border-radius': '6px',
  // The board's own paper, as the canvas over it paints it: a canvas a pixel short of its box leaves no seam.
  'background-color': 'var(--paper)',
  border: '1px solid var(--edge)',
  overflow: 'hidden',
  'pointer-events': 'none'
});

const name = styles('templateName', {
  'font-size': '13px',
  'font-weight': '600',
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'pointer-events': 'none'
});

const summary = styles('templateSummary', {
  'font-size': '11px',
  color: 'var(--muted)',
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'pointer-events': 'none'
});

const foot = styles('templateFoot', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '4px',
  padding: '4px 6px 6px 8px'
});

const remove = styles('templateRemove', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '24px',
    height: '24px',
    'border-radius': '6px',
    'font-size': '11px',
    color: 'var(--muted)'
  },
  states: {
    hover: { color: 'var(--danger)', 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)' }
  }
});

const hint = styles('templatesHint', {
  display: 'flex',
  'align-items': 'flex-start',
  gap: '8px',
  padding: '8px 10px',
  'border-radius': '9px',
  'font-size': '12px',
  'line-height': '1.4',
  color: 'var(--muted)',
  border: '1px dashed var(--edge)'
});

const addRow = styles('templatesAdd', { display: 'flex', gap: '6px', 'align-items': 'center' });

const codeBox = styles('templateCodeBox', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '32px',
    padding: '0px 10px',
    border: '1px solid var(--edge)',
    'border-radius': '8px',
    'background-color': 'var(--surface-2)',
    'font-size': '12px'
  },
  states: { 'focus-within': { 'border-color': 'var(--accent)', 'background-color': 'var(--surface)' } }
});

const codeField = styles('templateCodeField', { flex: '1', 'min-width': '0px' });

const addButton = styles('templateAddButton', {
  css: {
    ...BUTTON_RESET,
    height: '32px',
    padding: '0px 12px',
    'border-radius': '8px',
    'font-size': '12px',
    'font-weight': '600',
    color: 'var(--ink)',
    'background-color': 'var(--surface-2)',
    border: '1px solid var(--edge)'
  },
  states: {
    hover: { 'border-color': 'var(--accent)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  }
});

const ITEM = 'list_templateShelf.item';

/** What picking a template does: taken in hand, the library out of the way — put down with the next click. */
const takeSteps: StepSpec[] = [
  ...closePanels,
  boardAction('carry', { kind: 'template', template: `{{ ${ITEM}.id }}` })
];

const templateEntry = (): ElementSpec =>
  container({
    subType: 'li',
    class: entry,
    children: [
      button({
        content: '',
        class: pick,
        bind: [bindTemplate('title', 'templateShelf.item.title', '{{ source }} — drag it onto the board, or click')],
        flows: [
          [onClick(), ...takeSteps],
          [onPointerDown(), boardAction('carry', { kind: 'template', template: `{{ ${ITEM}.id }}`, drag: true })]
        ],
        children: [
          container({
            class: preview,
            children: [
              thumbnail({
                runtime: 'client',
                class: thumbCanvas,
                mode: 'view',
                bind: [
                  { to: 'elements', source: 'templateShelf.item.elements' },
                  { to: 'scheme', source: 'theme.resolved' }
                ]
              })
            ]
          }),
          text({ content: '', class: name, bind: { content: 'templateShelf.item.title' } }),
          text({
            content: '',
            class: summary,
            bind: [
              bindTemplate(
                'content',
                'templateShelf.item.elements',
                "{{ source|length }} {{ source|length == 1 ? 'element' : 'elements' }}"
              )
            ]
          })
        ]
      }),
      container({
        class: foot,
        children: [
          copyText({
            compact: true,
            text: '',
            label: 'Copy this template’s code — paste it into another board’s library to use it there',
            class: copyClass,
            bind: { text: 'templateShelf.item.id' },
            flows: [
              [
                declaredTrigger(COPY_DECLARATION, 'onCopied'),
                boardAction('chime', { sound: 'copy' }),
                notice('Template code copied — paste it under Templates in another board’s library', 'success')
              ]
            ]
          }),
          button({
            content: '',
            class: remove,
            title: 'Take it out of this board’s library',
            flows: [
              [
                onClick(),
                named(
                  'removed',
                  runServerAction({
                    actionId: TEMPLATE_REMOVE_ACTION,
                    input: { board: THIS_BOARD, code: `{{ ${ITEM}.id }}`, ...BOARD_PASS },
                    invalidateQueries: 'none'
                  })
                ),
                keepLibrary('removed'),
                whenFailed(
                  'removed',
                  notice('{{ removed.error ? removed.error : "That could not be removed" }}', 'danger')
                )
              ]
            ],
            children: [icon('fa-solid fa-xmark')]
          })
        ]
      })
    ]
  });

const CODE_FORM = 'template-code-form';

/** A template another board keeps, added here by its code — with Enter, or the button beside it. */
const addByCode = (): ElementSpec =>
  form({
    id: CODE_FORM,
    class: addRow,
    managedByInteractions: true,
    noValidate: true,
    flows: [
      [
        named('asked', onSubmit()),
        named(
          'added',
          runServerAction({
            actionId: TEMPLATE_ADD_ACTION,
            input: { board: THIS_BOARD, code: '{{ asked.values.templateCode }}', ...BOARD_PASS },
            invalidateQueries: 'none'
          })
        ),
        keepLibrary('added'),
        when(
          { field: 'added.status', operator: '=', value: 'completed' },
          notice('“{{ added.output.template.title }}” is in this board’s library now', 'success')
        ),
        when({ field: 'added.status', operator: '=', value: 'completed' }, resetForm(CODE_FORM)),
        whenFailed('added', notice('{{ added.error ? added.error : "That template could not be added" }}', 'danger'))
      ]
    ],
    children: [
      formControl({
        id: 'template-code',
        name: 'templateCode',
        label: '',
        placeholder: 'Paste a template’s code',
        required: false,
        autoComplete: false,
        class: codeField,
        slots: { input: codeBox }
      }),
      button({ id: 'template-add', content: 'Add', subType: 'submit', class: addButton })
    ]
  });

/** The library's first section — while nothing is searched for: the board's templates, and how to make or add one. */
export const templatesSection = (): ElementSpec =>
  container({
    id: 'library-templates',
    class: section,
    visible: { source: 'computed.librarySearch', template: '{{ not (source|trim) }}' },
    children: [
      text({ content: 'Templates', class: caption }),
      container({
        class: hint,
        visible: { source: BOARD_PROVIDER, template: `{{ ${LIBRARY}|length == 0 }}` },
        children: [
          icon('fa-regular fa-bookmark'),
          text({
            content:
              'What your team lays out every time — a retro’s columns, a check-in frame: select it and keep it with ' +
              'the bookmark in its tools. It shows up here, for everyone on this board.'
          })
        ]
      }),
      list({
        id: 'templateShelf',
        source: 'controlled',
        class: shelf,
        bind: [bindTemplate('items', BOARD_PROVIDER, TEMPLATES, { returns: 'value' })],
        children: [templateEntry()]
      }),
      addByCode()
    ]
  });
