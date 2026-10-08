import type { StyleCategory } from '@plitzi/sdk-shared';

/**
 * The properties each category of the inspector edits, in one place: the category reads them to tell what is set (the
 * dots in its header, the hint on its advanced toggle), and the inspector's search reads them to find which category
 * holds the property a person typed. `advanced` are the ones behind the category's sliders toggle.
 */
export type CategoryKeys = {
  title: string;
  dot: StyleCategory[];
  advanced: StyleCategory[];
};

export const LIST_KEYS: CategoryKeys = {
  title: 'List',
  dot: ['list-style'],
  advanced: []
};

export const LIST_ITEM_KEYS: CategoryKeys = {
  title: 'List Item',
  dot: ['list-style-type'],
  advanced: []
};

export const DISPLAY_KEYS: CategoryKeys = {
  title: 'Layout',
  dot: [
    'flex-direction',
    'flex-wrap',
    'align-items',
    'justify-content',
    'align-content',
    'column-gap',
    'row-gap',
    'grid-row-gap',
    'grid-column-gap',
    'grid-template-areas',
    'grid-template-columns',
    'grid-template-rows',
    'grid-auto-flow',
    'grid-auto-rows',
    'grid-auto-columns',
    'display'
  ],
  advanced: []
};

export const FLEX_CHILD_KEYS: CategoryKeys = {
  title: 'Flex Child',
  dot: ['align-self', 'order', 'flex-grow', 'flex-shrink', 'flex-basis'],
  advanced: []
};

export const SPACING_KEYS: CategoryKeys = {
  title: 'Spacing',
  dot: [
    'margin-top',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'padding-top',
    'padding-bottom',
    'padding-left',
    'padding-right'
  ],
  advanced: []
};

export const SIZE_KEYS: CategoryKeys = {
  title: 'Size',
  dot: [
    'width',
    'height',
    'min-width',
    'min-height',
    'max-width',
    'max-height',
    'aspect-ratio',
    'box-sizing',
    'overflow',
    'object-fit',
    'object-position',
    'container-type',
    'container-name'
  ],
  advanced: ['aspect-ratio', 'box-sizing', 'object-position', 'object-fit', 'container-type', 'container-name']
};

export const POSITION_KEYS: CategoryKeys = {
  title: 'Position',
  dot: ['position', 'top', 'bottom', 'z-index', 'float', 'clear', 'left', 'right'],
  advanced: ['float', 'clear']
};

export const TYPOGRAPHY_KEYS: CategoryKeys = {
  title: 'Typography',
  dot: [
    'font-family',
    'font-weight',
    'font-size',
    'line-height',
    'color',
    'text-align',
    'font-style',
    'text-decoration',
    'text-decoration-thickness',
    'text-underline-offset',
    'letter-spacing',
    'word-spacing',
    'text-indent',
    'text-transform',
    'direction',
    'text-shadow',
    'white-space',
    'text-wrap',
    'word-break',
    'overflow-wrap',
    'hyphens',
    'vertical-align',
    'text-overflow',
    'line-clamp',
    'font-variant-numeric',
    'font-feature-settings',
    '-webkit-text-fill-color'
  ],
  advanced: [
    'text-decoration-thickness',
    'text-underline-offset',
    'word-break',
    'overflow-wrap',
    'hyphens',
    'vertical-align',
    'text-shadow',
    'font-variant-numeric',
    'font-feature-settings',
    '-webkit-text-fill-color'
  ]
};

export const BACKGROUND_KEYS: CategoryKeys = {
  title: 'Background',
  dot: [
    'background-color',
    'background-image',
    'background-attachment',
    'background-position',
    'background-repeat',
    'background-clip',
    'background-size',
    'background-blend-mode',
    'mask-image'
  ],
  advanced: ['background-blend-mode', 'mask-image']
};

export const BORDER_KEYS: CategoryKeys = {
  title: 'Border',
  dot: [
    'border-top-style',
    'border-top-width',
    'border-top-color',
    'border-bottom-style',
    'border-bottom-width',
    'border-bottom-color',
    'border-left-style',
    'border-left-width',
    'border-left-color',
    'border-right-style',
    'border-right-width',
    'border-right-color',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-left-radius',
    'border-bottom-right-radius'
  ],
  advanced: []
};

export const EFFECTS_KEYS: CategoryKeys = {
  title: 'Effects',
  dot: [
    'opacity',
    'visibility',
    'cursor',
    'transition',
    'box-shadow',
    'filter',
    'backdrop-filter',
    'mix-blend-mode',
    'isolation',
    'clip-path',
    'transform',
    'transform-origin',
    'perspective',
    'will-change'
  ],
  advanced: [
    'transform-origin',
    'perspective',
    'backdrop-filter',
    'mix-blend-mode',
    'isolation',
    'clip-path',
    'will-change'
  ]
};

export const OTHERS_KEYS: CategoryKeys = {
  title: 'Others',
  dot: [
    'pointer-events',
    'user-select',
    'touch-action',
    'resize',
    'appearance',
    'scroll-behavior',
    'overscroll-behavior',
    'scroll-snap-type',
    'scroll-snap-align',
    'scroll-snap-stop',
    'scroll-padding-top',
    'scroll-margin-top',
    'accent-color',
    'caret-color',
    'color-scheme',
    'scrollbar-width',
    'scrollbar-color',
    'outline-width',
    'outline-style',
    'outline-color',
    'outline-offset',
    'border-collapse',
    'border-spacing',
    'table-layout',
    'fill',
    'stroke',
    'stroke-width'
  ],
  advanced: [
    'touch-action',
    'resize',
    'appearance',
    'scroll-behavior',
    'overscroll-behavior',
    'scroll-snap-type',
    'scroll-snap-align',
    'scroll-snap-stop',
    'scroll-padding-top',
    'scroll-margin-top',
    'accent-color',
    'caret-color',
    'color-scheme',
    'scrollbar-width',
    'scrollbar-color',
    'border-collapse',
    'border-spacing',
    'table-layout',
    'fill',
    'stroke',
    'stroke-width'
  ]
};

/** The categories with no properties of their own to search by — found by their title alone. */
export const VARIABLES_KEYS: CategoryKeys = { title: 'Variables', dot: [], advanced: [] };

export const RAW_STYLE_KEYS: CategoryKeys = { title: 'Raw Style', dot: [], advanced: [] };

/** Every category, by the id its collapsed state is stored under, in the order the inspector draws them. */
export const CATEGORY_KEYS = {
  list: LIST_KEYS,
  listItem: LIST_ITEM_KEYS,
  display: DISPLAY_KEYS,
  displayFlexChild: FLEX_CHILD_KEYS,
  spacing: SPACING_KEYS,
  size: SIZE_KEYS,
  position: POSITION_KEYS,
  typography: TYPOGRAPHY_KEYS,
  background: BACKGROUND_KEYS,
  border: BORDER_KEYS,
  effects: EFFECTS_KEYS,
  others: OTHERS_KEYS,
  variables: VARIABLES_KEYS,
  rawStyle: RAW_STYLE_KEYS
} as const satisfies Record<string, CategoryKeys>;

export type CategoryId = keyof typeof CATEGORY_KEYS;

// `Object.keys` types its answer as `string[]` whatever the object; these keys are exactly `CategoryId` by construction.
export const CATEGORY_IDS = Object.keys(CATEGORY_KEYS) as CategoryId[];
