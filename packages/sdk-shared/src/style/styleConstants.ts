import type { StyleCategory, StyleValue } from '../types';

// Display
export const DISPLAY = 'display';
export const FLEX_WRAP = 'flex-wrap';
export const FLEX_DIRECTION = 'flex-direction';
export const ALIGN_ITEMS = 'align-items';
export const JUSTIFY_CONTENT = 'justify-content';
export const ALIGN_CONTENT = 'align-content';
export const ROW_GAP = 'row-gap';
export const COLUMN_GAP = 'column-gap';
export const GRID_ROW_GAP = 'grid-row-gap';
export const GRID_COLUMN_GAP = 'grid-column-gap';
export const GRID_TEMPLATE_AREAS = 'grid-template-areas';
export const GRID_TEMPLATE_COLUMNS = 'grid-template-columns';
export const GRID_TEMPLATE_ROWS = 'grid-template-rows';
export const GRID_AUTO_FLOW = 'grid-auto-flow';
export const GRID_AUTO_ROWS = 'grid-auto-rows';
export const GRID_AUTO_COLUMNS = 'grid-auto-columns';

// DisplayFlexChild
export const ALIGN_SELF = 'align-self';
export const ORDER = 'order';
export const FLEX_GROW = 'flex-grow';
export const FLEX_SHRINK = 'flex-shrink';
export const FLEX_BASIS = 'flex-basis';

// List
export const LIST_STYLE = 'list-style';

// ListItem
export const LIST_ITEM_TYPE = 'list-style-type';

// Background
export const BACKGROUND_COLOR = 'background-color';
export const BACKGROUND_IMAGE = 'background-image';
export const BACKGROUND_POSITION = 'background-position';
export const BACKGROUND_SIZE = 'background-size';
export const BACKGROUND_REPEAT = 'background-repeat';
export const BACKGROUND_CLIP = 'background-clip';
export const BACKGROUND_ATTACHMENT = 'background-attachment';

// Border
export const BORDER_TOP_STYLE = 'border-top-style';
export const BORDER_TOP_WIDTH = 'border-top-width';
export const BORDER_TOP_COLOR = 'border-top-color';
export const BORDER_BOTTOM_STYLE = 'border-bottom-style';
export const BORDER_BOTTOM_WIDTH = 'border-bottom-width';
export const BORDER_BOTTOM_COLOR = 'border-bottom-color';
export const BORDER_LEFT_STYLE = 'border-left-style';
export const BORDER_LEFT_WIDTH = 'border-left-width';
export const BORDER_LEFT_COLOR = 'border-left-color';
export const BORDER_RIGHT_STYLE = 'border-right-style';
export const BORDER_RIGHT_WIDTH = 'border-right-width';
export const BORDER_RIGHT_COLOR = 'border-right-color';
export const BORDER_RADIUS_TOP_LEFT = 'border-top-left-radius';
export const BORDER_RADIUS_TOP_RIGHT = 'border-top-right-radius';
export const BORDER_RADIUS_BOTTOM_LEFT = 'border-bottom-left-radius';
export const BORDER_RADIUS_BOTTOM_RIGHT = 'border-bottom-right-radius';

// Effects
export const OPACITY = 'opacity';
export const CURSOR = 'cursor';
export const TRANSITION = 'transition';
export const BOX_SHADOW = 'box-shadow';
export const FILTER = 'filter';
export const TRANSFORM = 'transform';

// Position
export const POSITION = 'position';
export const FLOAT = 'float';
export const CLEAR = 'clear';
export const ZINDEX = 'z-index';
export const TOP = 'top';
export const BOTTOM = 'bottom';
export const LEFT = 'left';
export const RIGHT = 'right';

// Size
export const WIDTH = 'width';
export const HEIGHT = 'height';
export const MIN_WIDTH = 'min-width';
export const MIN_HEIGHT = 'min-height';
export const MAX_WIDTH = 'max-width';
export const MAX_HEIGHT = 'max-height';
export const OVERFLOW = 'overflow';
export const OBJECT_FIT = 'object-fit';
export const OBJECT_POSITION = 'object-position';

// Spacing
export const MARGIN_TOP = 'margin-top';
export const MARGIN_BOTTOM = 'margin-bottom';
export const MARGIN_LEFT = 'margin-left';
export const MARGIN_RIGHT = 'margin-right';
export const PADDING_TOP = 'padding-top';
export const PADDING_BOTTOM = 'padding-bottom';
export const PADDING_LEFT = 'padding-left';
export const PADDING_RIGHT = 'padding-right';

// Typography
export const FONT_FAMILY = 'font-family';
export const FONT_WEIGHT = 'font-weight';
export const FONT_SIZE = 'font-size';
export const LINE_HEIGHT = 'line-height';
export const COLOR = 'color';
export const TEXT_ALIGN = 'text-align';
export const FONT_STYLE = 'font-style';
export const TEXT_DECORATION = 'text-decoration';
export const LETTER_SPACING = 'letter-spacing';
export const TEXT_INDENT = 'text-indent';
export const TEXT_TRANSFORM = 'text-transform';
export const DIRECTION = 'direction';
export const WHITE_SPACE = 'white-space';
export const TEXT_WRAP = 'text-wrap';
export const TEXT_OVERFLOW = 'text-overflow';
export const TEXT_SHADOW = 'text-shadow';

export const inheritableAttributes = {
  DISPLAY,
  FLEX_WRAP,
  FLEX_DIRECTION,
  ALIGN_ITEMS,
  JUSTIFY_CONTENT,
  ALIGN_CONTENT,
  ROW_GAP,
  COLUMN_GAP,
  ALIGN_SELF,
  ORDER,
  FLEX_GROW,
  FLEX_SHRINK,
  FLEX_BASIS,
  LIST_STYLE,
  LIST_ITEM_TYPE,
  BACKGROUND_COLOR,
  BACKGROUND_IMAGE,
  BACKGROUND_POSITION,
  BACKGROUND_SIZE,
  BACKGROUND_REPEAT,
  BACKGROUND_ATTACHMENT,
  BORDER_TOP_STYLE,
  BORDER_TOP_WIDTH,
  BORDER_TOP_COLOR,
  BORDER_BOTTOM_STYLE,
  BORDER_BOTTOM_WIDTH,
  BORDER_BOTTOM_COLOR,
  BORDER_LEFT_STYLE,
  BORDER_LEFT_WIDTH,
  BORDER_LEFT_COLOR,
  BORDER_RIGHT_STYLE,
  BORDER_RIGHT_WIDTH,
  BORDER_RIGHT_COLOR,
  BORDER_RADIUS_TOP_LEFT,
  BORDER_RADIUS_TOP_RIGHT,
  BORDER_RADIUS_BOTTOM_LEFT,
  BORDER_RADIUS_BOTTOM_RIGHT,
  OPACITY,
  CURSOR,
  TRANSITION,
  BOX_SHADOW,
  FILTER,
  TRANSFORM,
  POSITION,
  FLOAT,
  CLEAR,
  ZINDEX,
  BOTTOM,
  TOP,
  LEFT,
  RIGHT,
  WIDTH,
  HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  OVERFLOW,
  OBJECT_FIT,
  OBJECT_POSITION,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  MARGIN_TOP,
  MARGIN_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  LINE_HEIGHT,
  COLOR,
  TEXT_ALIGN,
  FONT_STYLE,
  TEXT_DECORATION,
  LETTER_SPACING,
  TEXT_INDENT,
  TEXT_TRANSFORM,
  DIRECTION,
  WHITE_SPACE,
  TEXT_WRAP,
  TEXT_OVERFLOW,
  TEXT_SHADOW
};

export const inheritableAttributesBase = [
  TEXT_DECORATION,
  LINE_HEIGHT,
  LETTER_SPACING,
  COLOR,
  DIRECTION,
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  TEXT_ALIGN,
  TEXT_INDENT,
  TEXT_SHADOW,
  TEXT_TRANSFORM,
  WHITE_SPACE,
  TEXT_WRAP,
  TEXT_OVERFLOW
];

export const StyleConstants = {
  // Display
  DISPLAY,
  FLEX_WRAP,
  FLEX_DIRECTION,
  ALIGN_ITEMS,
  JUSTIFY_CONTENT,
  ALIGN_CONTENT,
  ROW_GAP,
  COLUMN_GAP,
  GRID_ROW_GAP,
  GRID_COLUMN_GAP,
  GRID_TEMPLATE_AREAS,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS,
  GRID_AUTO_FLOW,
  GRID_AUTO_ROWS,
  GRID_AUTO_COLUMNS,
  // DisplayFlexChild
  ALIGN_SELF,
  ORDER,
  FLEX_GROW,
  FLEX_SHRINK,
  FLEX_BASIS,
  // List
  LIST_STYLE,
  // ListItem
  LIST_ITEM_TYPE,
  // Background
  BACKGROUND_COLOR,
  BACKGROUND_IMAGE,
  BACKGROUND_POSITION,
  BACKGROUND_CLIP,
  BACKGROUND_SIZE,
  BACKGROUND_REPEAT,
  BACKGROUND_ATTACHMENT,
  // Border
  BORDER_TOP_STYLE,
  BORDER_TOP_WIDTH,
  BORDER_TOP_COLOR,
  BORDER_BOTTOM_STYLE,
  BORDER_BOTTOM_WIDTH,
  BORDER_BOTTOM_COLOR,
  BORDER_LEFT_STYLE,
  BORDER_LEFT_WIDTH,
  BORDER_LEFT_COLOR,
  BORDER_RIGHT_STYLE,
  BORDER_RIGHT_WIDTH,
  BORDER_RIGHT_COLOR,
  BORDER_RADIUS_TOP_LEFT,
  BORDER_RADIUS_TOP_RIGHT,
  BORDER_RADIUS_BOTTOM_LEFT,
  BORDER_RADIUS_BOTTOM_RIGHT,
  // Effects
  OPACITY,
  CURSOR,
  TRANSITION,
  BOX_SHADOW,
  FILTER,
  TRANSFORM,
  // Position
  POSITION,
  FLOAT,
  CLEAR,
  ZINDEX,
  BOTTOM,
  TOP,
  LEFT,
  RIGHT,
  // Size
  WIDTH,
  HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  OVERFLOW,
  OBJECT_FIT,
  OBJECT_POSITION,
  // Spacing
  MARGIN_LEFT,
  MARGIN_RIGHT,
  MARGIN_TOP,
  MARGIN_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  // Typography
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  LINE_HEIGHT,
  COLOR,
  TEXT_ALIGN,
  FONT_STYLE,
  TEXT_DECORATION,
  LETTER_SPACING,
  TEXT_INDENT,
  TEXT_TRANSFORM,
  DIRECTION,
  WHITE_SPACE,
  TEXT_WRAP,
  TEXT_OVERFLOW,
  TEXT_SHADOW
} as const;

export const StyleBindingsAllowed = Object.values(StyleConstants).map(attr => ({ path: attr, label: attr }));

export const baseDefaultValue: Record<StyleCategory, StyleValue> = {
  // display
  display: 'block',
  'flex-wrap': 'nowrap',
  'flex-direction': 'row',
  'align-items': 'stretch',
  'justify-content': 'flex-start',
  'align-content': 'flex-start',
  'row-gap': '0px',
  'column-gap': '0px',
  'grid-row-gap': '0px',
  'grid-column-gap': '0px',
  'grid-template-areas': 'none',
  'grid-template-columns': 'none',
  'grid-template-rows': 'none',
  'grid-auto-flow': 'row',
  'grid-auto-rows': 'auto',
  'grid-auto-columns': 'auto',
  // DisplayFlexChild
  'align-self': 'auto',
  order: '0',
  'flex-grow': '0',
  'flex-shrink': '1',
  'flex-basis': 'auto',
  // List
  'list-style': 'disc',
  // ListItem
  'list-style-type': 'disc',
  // Background
  'background-color': 'transparent',
  'background-image': 'url("https://cdn.plitzi.com/resources/img/background-image.svg")',
  'background-position': '0px 0px',
  'background-size': 'auto',
  'background-clip': 'border-box',
  'background-repeat': 'repeat',
  'background-attachment': 'scroll',
  // Border
  'border-top-style': 'solid',
  'border-top-width': '0px',
  'border-top-color': '#000000',
  'border-bottom-style': 'solid',
  'border-bottom-width': '0px',
  'border-bottom-color': '#000000',
  'border-left-style': 'solid',
  'border-left-width': '0px',
  'border-left-color': '#000000',
  'border-right-style': 'solid',
  'border-right-width': '0px',
  'border-right-color': '#000000',
  'border-top-left-radius': '0px',
  'border-top-right-radius': '0px',
  'border-bottom-left-radius': '0px',
  'border-bottom-right-radius': '0px',
  // Effects
  opacity: '1',
  cursor: 'auto',
  transition: 'opacity 200ms ease 0ms',
  'box-shadow': '1px 1px 3px 1px black',
  filter: 'blur(5px)',
  transform: 'translate3d(0px, 0px, 0px)',
  // Position
  position: 'static',
  float: 'none',
  clear: 'none',
  'z-index': 0,
  top: 'auto',
  bottom: 'auto',
  left: 'auto',
  right: 'auto',
  // Size
  width: 'auto',
  height: 'auto',
  'min-width': '0px',
  'min-height': '0px',
  'max-width': 'none',
  'max-height': 'none',
  overflow: 'visible',
  'object-fit': 'fill',
  'object-position': '50% 50%',
  // Spacing
  'margin-top': '0px',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'margin-right': '0px',
  'padding-top': '0px',
  'padding-bottom': '0px',
  'padding-left': '0px',
  'padding-right': '0px',
  // Typography
  'font-family': 'Arial',
  'font-weight': 400,
  'font-size': '0px',
  'line-height': '0px',
  color: '#000000',
  'text-align': 'left',
  'font-style': 'normal',
  'text-decoration': 'none',
  'letter-spacing': '0px',
  'text-indent': '0px',
  'text-transform': 'none',
  direction: 'ltr',
  'white-space': 'normal',
  'text-wrap': 'wrap',
  'text-overflow': 'clip',
  'text-shadow': ''
};
