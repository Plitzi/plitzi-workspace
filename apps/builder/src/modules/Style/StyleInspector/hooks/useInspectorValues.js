// Packages
import { use, useMemo } from 'react';
import pick from 'lodash/pick';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';
import {
  // typography
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
  TEXT_SHADOW,
  WHITE_SPACE,
  TEXT_WRAP,
  TEXT_OVERFLOW,
  // list
  LIST_STYLE,
  // listItem
  LIST_ITEM_TYPE,
  // displayFlexChild
  ALIGN_SELF,
  ORDER,
  FLEX_GROW,
  FLEX_SHRINK,
  FLEX_BASIS,
  // display
  DISPLAY,
  FLEX_WRAP,
  FLEX_DIRECTION,
  ALIGN_ITEMS,
  JUSTIFY_CONTENT,
  ALIGN_CONTENT,
  COLUMN_GAP,
  ROW_GAP,
  // spacing
  MARGIN_TOP,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT,
  // size
  WIDTH,
  HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  OVERFLOW,
  OBJECT_FIT,
  OBJECT_POSITION,
  // position
  POSITION,
  TOP,
  BOTTOM,
  ZINDEX,
  FLOAT,
  CLEAR,
  LEFT,
  RIGHT,
  // background
  BACKGROUND_COLOR,
  BACKGROUND_IMAGE,
  BACKGROUND_POSITION,
  BACKGROUND_SIZE,
  BACKGROUND_REPEAT,
  BACKGROUND_ATTACHMENT,
  // border
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
  // effects
  OPACITY,
  CURSOR,
  TRANSITION,
  BOX_SHADOW,
  FILTER,
  TRANSFORM,
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  GRID_TEMPLATE_AREAS,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS,
  GRID_AUTO_FLOW,
  GRID_AUTO_ROWS,
  GRID_AUTO_COLUMNS
} from '@plitzi/sdk-shared/style/styleConstants';

// Relatives
import StyleInspectorContext from '../StyleInspectorContext';

const baseDefaultValue = {
  [FONT_FAMILY]: 'Arial',
  [FONT_WEIGHT]: 400,
  [FONT_SIZE]: '0px',
  [LINE_HEIGHT]: '0px',
  [COLOR]: '#000000',
  [TEXT_ALIGN]: 'left',
  [FONT_STYLE]: 'normal',
  [TEXT_DECORATION]: 'none',
  [LETTER_SPACING]: '0px',
  [TEXT_INDENT]: '0px',
  [TEXT_TRANSFORM]: 'none',
  [DIRECTION]: 'ltr',
  [WHITE_SPACE]: 'normal',
  [TEXT_WRAP]: 'wrap',
  [TEXT_OVERFLOW]: 'clip',
  [TEXT_SHADOW]: '',
  [LIST_STYLE]: 'disc',
  [LIST_ITEM_TYPE]: 'disc',
  [FLEX_GROW]: '0',
  [FLEX_SHRINK]: '1',
  [FLEX_BASIS]: 'auto',
  [ALIGN_SELF]: 'auto',
  [ORDER]: '0',
  [DISPLAY]: 'block',
  [FLEX_DIRECTION]: 'row',
  [ALIGN_ITEMS]: 'stretch',
  [JUSTIFY_CONTENT]: 'flex-start',
  [ROW_GAP]: '0px',
  [COLUMN_GAP]: '0px',
  [FLEX_WRAP]: 'nowrap',
  [ALIGN_CONTENT]: 'flex-start',
  [GRID_ROW_GAP]: '0px',
  [GRID_COLUMN_GAP]: '0px',
  [GRID_TEMPLATE_AREAS]: 'none',
  [GRID_TEMPLATE_COLUMNS]: 'none',
  [GRID_TEMPLATE_ROWS]: 'none',
  [GRID_AUTO_FLOW]: 'row',
  [GRID_AUTO_ROWS]: 'auto',
  [GRID_AUTO_COLUMNS]: 'auto',
  [MARGIN_TOP]: '0px',
  [MARGIN_BOTTOM]: '0px',
  [MARGIN_LEFT]: '0px',
  [MARGIN_RIGHT]: '0px',
  [PADDING_TOP]: '0px',
  [PADDING_BOTTOM]: '0px',
  [PADDING_LEFT]: '0px',
  [PADDING_RIGHT]: '0px',
  [WIDTH]: 'auto',
  [HEIGHT]: 'auto',
  [MIN_WIDTH]: '0px',
  [MIN_HEIGHT]: '0px',
  [MAX_WIDTH]: 'none',
  [MAX_HEIGHT]: 'none',
  [OVERFLOW]: 'visible',
  [OBJECT_FIT]: 'fill',
  [OBJECT_POSITION]: '50% 50%',
  [POSITION]: 'static',
  [FLOAT]: 'none',
  [CLEAR]: 'none',
  [TOP]: 'auto',
  [BOTTOM]: 'auto',
  [LEFT]: 'auto',
  [RIGHT]: 'auto',
  [ZINDEX]: 0,
  [BACKGROUND_COLOR]: 'transparent',
  [BACKGROUND_IMAGE]: 'url("https://cdn.plitzi.com/resources/img/background-image.svg")',
  [BACKGROUND_SIZE]: 'auto',
  [BACKGROUND_POSITION]: '0px 0px',
  [BACKGROUND_REPEAT]: 'repeat',
  [BACKGROUND_ATTACHMENT]: 'scroll',
  [BORDER_RADIUS_TOP_LEFT]: '0px',
  [BORDER_RADIUS_TOP_RIGHT]: '0px',
  [BORDER_RADIUS_BOTTOM_LEFT]: '0px',
  [BORDER_RADIUS_BOTTOM_RIGHT]: '0px',
  [BORDER_TOP_WIDTH]: '0px',
  [BORDER_BOTTOM_WIDTH]: '0px',
  [BORDER_LEFT_WIDTH]: '0px',
  [BORDER_RIGHT_WIDTH]: '0px',
  [BORDER_TOP_STYLE]: 'solid',
  [BORDER_BOTTOM_STYLE]: 'solid',
  [BORDER_LEFT_STYLE]: 'solid',
  [BORDER_RIGHT_STYLE]: 'solid',
  [BORDER_TOP_COLOR]: '#000000',
  [BORDER_BOTTOM_COLOR]: '#000000',
  [BORDER_LEFT_COLOR]: '#000000',
  [BORDER_RIGHT_COLOR]: '#000000',
  [OPACITY]: '1',
  [CURSOR]: 'auto',
  [TRANSITION]: 'opacity 200ms ease 0ms',
  [BOX_SHADOW]: '1px 1px 3px 1px black',
  [FILTER]: 'blur(5px)',
  [TRANSFORM]: 'translate3d(0px, 0px, 0px)'
};

/**
 * @param {{
 *   keys?: string[];
 *   skipContext?: boolean;
 *   context?: object;
 *   skipValidations?: boolean;
 *   asValue?: boolean;
 *   defaultValues?: { [key: string]: any };
 *   strictMode?: boolean;
 * }} props
 * @returns {{
 *       values: object;
 *       hasInherit: boolean;
 *       hasBinding: boolean;
 *       hasVariables: boolean;
 *       hasValues: boolean;
 *     }
 *   | any}
 */
const useInspectorValues = props => {
  const {
    keys,
    skipContext = false,
    context = {},
    asValue = false,
    defaultValues = emptyObject,
    strictMode = false
  } = props;
  if (keys && !Array.isArray(keys)) {
    throw new Error('keys is not an array');
  }

  let { inheritData, bindingData, values, variables } = {};
  if (skipContext) {
    ({ inheritData, bindingData, values, variables } = context);
  } else {
    ({ inheritData, bindingData, values, variables } = use(StyleInspectorContext));
  }

  const hasInherit = useMemo(() => {
    return (
      !!keys &&
      !asValue &&
      inheritData &&
      Object.keys(inheritData).filter(key => keys.includes(key) || keys.length === 0).length > 0
    );
  }, [keys, inheritData, asValue]);

  const hasBinding = useMemo(() => {
    return (
      !!keys &&
      !asValue &&
      bindingData &&
      Object.keys(bindingData).filter(key => keys.includes(key) || keys.length === 0).length > 0
    );
  }, [keys, bindingData, asValue]);

  const hasVariables = useMemo(
    () =>
      !!keys &&
      !asValue &&
      Object.keys(pick(values, keys)).filter(key => typeof values[key] === 'string' && values[key].includes('var('))
        .length > 0,
    [keys, values, asValue]
  );

  const hasValues = useMemo(() => {
    if (!keys) {
      return false;
    }

    if (keys.length > 0) {
      return !asValue && Object.keys(pick(values, keys)).length > 0;
    }

    return !asValue && Object.keys(values).length > 0;
  }, [keys, values, asValue]);

  const valuesParsed = useMemo(() => {
    const valuesParsedAux = {};
    if (!keys) {
      return valuesParsedAux;
    }

    keys.forEach(key => {
      let value;
      if (strictMode) {
        value = get(values, key, get(defaultValues, key));
      } else {
        value = get(
          values,
          key,
          get(
            inheritData,
            `${key}.0.value`,
            get(bindingData, `${key}.0.value`, get(defaultValues, key, baseDefaultValue[key]))
          )
        );
      }

      if (typeof value === 'string' && value.includes('var(')) {
        [...value.matchAll(VARIABLE_REGEX)].forEach(match => {
          value = value.replace(match[0], get(variables, match.groups.token, match[0]));
        });
      }

      valuesParsedAux[key] = value;
    });

    if (keys.length === 1) {
      return valuesParsedAux[keys[0]];
    }

    return valuesParsedAux;
  }, [keys, values, defaultValues, strictMode, variables, inheritData]);

  if (asValue) {
    return valuesParsed;
  }

  return { values: valuesParsed, hasInherit, hasBinding, hasVariables, hasValues };
};

export default useInspectorValues;
