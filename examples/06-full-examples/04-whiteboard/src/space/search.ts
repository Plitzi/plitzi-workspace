import {
  bindTemplate,
  button,
  container,
  form,
  formControl,
  list,
  named,
  on,
  onClick,
  onKey,
  onSubmit,
  resetForm,
  setFieldValue,
  setState,
  styles,
  text
} from '@plitzi/sdk-authoring';

import { BUTTON_RESET, FLOAT, icon, iconAction, panelMotion } from './kit.ts';
import { boardAction } from './stylePanel.ts';

import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * Searching the board: a bar over it that dims whatever does not match and goes through what does, one at a time —
 * Enter the next, ↑ the one before. The query is the board's own language (`board/query.ts`): words,
 * `#tags` written in anything, `@people`, `in:column`, `is:open`, `type:card`, `color:red` — the same an agent's
 * `find_elements` reads. Under it, the tags the board holds, each a click from being searched for.
 */

/** Searching for `query`: kept in the page's state — so the field shows it — and given to the canvas. */
const searchFor = (query: string): StepSpec[] => [
  setState({ key: 'searchQuery', type: 'text', value: query }),
  boardAction('search', { query })
];

/** Opened by the button or ⌘F — with the field focused, its container mounted as it is shown. */
export const openSearch: StepSpec[] = [setState({ key: 'searchOpen', type: 'boolean', value: true })];

/** The field's form: it holds what is typed, so a search is emptied — or set — through it, not around it. */
const FORM = 'search-form';

/** Closed, its field emptied for next time, and the board shown whole again. */
const closeSearch: StepSpec[] = [
  resetForm(FORM),
  setState({ key: 'searchOpen', type: 'boolean', value: false }),
  ...searchFor('')
];

const BAR_MOTION = panelMotion({ from: 'above', rest: 'translateX(-50%)' });

const bar = styles('boardSearchBar', {
  css: {
    desktop: {
      ...BAR_MOTION.desktop,
      ...FLOAT,
      position: 'absolute',
      top: '70px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '4',
      display: 'flex',
      'flex-direction': 'column',
      gap: '8px',
      width: 'min(560px, calc(100vw - 24px))',
      padding: '8px'
    },
    mobile: { ...BAR_MOTION.mobile, top: '64px' }
  },
  states: BAR_MOTION.states
});

const row = styles('boardSearchRow', { display: 'flex', 'align-items': 'center', gap: '4px' });

const field = styles('boardSearchForm', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  flex: '1',
  'min-width': '0px',
  padding: '0px 4px 0px 10px',
  color: 'var(--muted)'
});

const fieldControl = styles('boardSearchControl', { flex: '1', 'min-width': '0px' });

/** The field draws no box of its own: the bar is its box. */
const fieldBox = styles('boardSearchBox', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '34px',
    padding: '0px',
    border: '0px',
    'background-color': 'transparent',
    'box-shadow': 'none',
    'font-size': '14px'
  }
});

const count = styles('boardSearchCount', {
  padding: '0px 6px',
  'font-size': '12px',
  'font-weight': '600',
  color: 'var(--muted)',
  'white-space': 'nowrap',
  'font-variant-numeric': 'tabular-nums'
});

const tags = styles('boardSearchTags', {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '6px',
  margin: '0px',
  padding: '0px 4px 4px',
  'list-style-type': 'none'
});

const tag = styles('boardSearchTag', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '6px',
    height: '26px',
    padding: '0px 10px',
    'border-radius': '999px',
    'font-size': '12px',
    'font-weight': '600',
    color: 'var(--accent)',
    'background-color': 'var(--accent-soft)'
  },
  states: {
    hover: { filter: 'brightness(0.95)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

const tagCount = styles('boardSearchTagCount', { color: 'var(--muted)', 'font-weight': '500' });

const hint = styles('boardSearchHint', { padding: '0px 8px 4px', 'font-size': '12px', color: 'var(--muted)' });

/** The magnifier in the corner that opens it — ⌘F does too. */
export const searchButton = (): ElementSpec =>
  iconAction({
    id: 'search-open',
    icon: 'fa-solid fa-magnifying-glass',
    title: 'Search the board — ⌘F',
    flow: [onClick(), ...openSearch]
  });

export const searchBar = (): ElementSpec =>
  container({
    id: 'search-bar',
    class: bar,
    visible: 'computed.searchOpen',
    // Mounted the first time it opens and kept, so it leaves whole; its field takes the focus each time it is shown.
    loadStrategy: 'lazy',
    flows: [[onKey('escape'), ...closeSearch]],
    children: [
      container({
        class: row,
        children: [
          form({
            id: FORM,
            class: field,
            managedByInteractions: true,
            noValidate: true,
            flows: [[onSubmit(), boardAction('searchStep', { direction: 1 })]],
            children: [
              icon('fa-solid fa-magnifying-glass'),
              formControl({
                id: 'search-query',
                name: 'query',
                label: '',
                placeholder: 'Search — words, #tag, @name, in:column, is:open',
                required: false,
                autoComplete: false,
                autoFocus: true,
                class: fieldControl,
                slots: { input: fieldBox },
                flows: [[named('typed', on('onChange')), ...searchFor('{{ typed.value }}')]]
              })
            ]
          }),
          text({
            content: '',
            class: count,
            visible: { source: 'computed.searchQuery', template: '{{ source|trim != "" }}' },
            bind: [
              bindTemplate(
                'content',
                'computed.searchCount',
                "{{ source == 0 ? 'Nothing found' : (computed.searchIndex > 0 ? computed.searchIndex ~ ' of ' ~ source : source ~ ' found') }}"
              )
            ]
          }),
          iconAction({
            id: 'search-previous',
            icon: 'fa-solid fa-chevron-up',
            title: 'The one before',
            flow: [onClick(), boardAction('searchStep', { direction: -1 })]
          }),
          iconAction({
            id: 'search-next',
            icon: 'fa-solid fa-chevron-down',
            title: 'The next one — Enter',
            flow: [onClick(), boardAction('searchStep', { direction: 1 })]
          }),
          iconAction({
            id: 'search-close',
            icon: 'fa-solid fa-xmark',
            title: 'Close — Esc',
            flow: [onClick(), ...closeSearch]
          })
        ]
      }),
      list({
        id: 'tagList',
        source: 'controlled',
        class: tags,
        bind: [bindTemplate('items', 'computed.tags', '{{ source }}', { returns: 'value' })],
        children: [
          container({
            subType: 'li',
            children: [
              button({
                content: '',
                class: tag,
                flows: [
                  [
                    onClick(),
                    setFieldValue(FORM, 'query', '#{{ list_tagList.item.tag }}'),
                    ...searchFor('#{{ list_tagList.item.tag }}')
                  ]
                ],
                children: [
                  text({ content: '', bind: [bindTemplate('content', 'tagList.item.tag', '#{{ source }}')] }),
                  text({ content: '', class: tagCount, bind: { content: 'tagList.item.count' } })
                ]
              })
            ]
          })
        ]
      }),
      text({
        content: 'Tag anything by writing #word in it. Also: @name, in:column, is:open, is:done, type:card, color:red',
        class: hint,
        visible: { source: 'computed.tags', template: '{{ source|length == 0 }}' }
      })
    ]
  });
