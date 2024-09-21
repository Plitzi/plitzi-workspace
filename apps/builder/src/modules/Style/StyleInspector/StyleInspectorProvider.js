// Packages
import React, { useCallback, use, useMemo } from 'react';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import set from 'lodash/set';
import omit from 'lodash/omit';
import { produce } from 'immer';

// Monorepo
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
} from '@plitzi/sdk-style/StyleConstants';
import { StyleSelectors, makeSelector } from '@plitzi/sdk-style/StyleHelper';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Relatives
import StyleInspectorContext from './StyleInspectorContext';
import useStyleBinding from './hooks/useStyleBinding';

const defaultValue = {
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
 *   children: React.ReactNode;
 *   selector: string;
 *   styleSelector: string;
 *   element: object;
 *   inheritData: object;
 * }} props
 * @returns {React.ReactElement}
 */
const StyleInspectorProvider = props => {
  const { children, selector = '', styleSelector = 'base', element, inheritData } = props;
  const { displayMode } = use(AppContext);
  const { builderHandler } = use(BuilderContext);
  const { style } = use(BuilderStyleContext);
  const bindingData = useStyleBinding({ element });
  const selectorType = get(style, `platform.${displayMode}.${selector}.type`);
  const values = get(style, `platform.${displayMode}.${selector}.attributes`);

  const setValue = useCallback(
    (styleKey, value = undefined) => {
      if (typeof styleKey === 'object') {
        Object.keys({ ...styleKey }).forEach(styleKeyItem => {
          if (get(bindingData, styleKeyItem)) {
            delete value[styleKeyItem];
            delete styleKey[styleKeyItem];
          }
        });
      } else if (typeof styleKey === 'string' && get(bindingData, styleKey)) {
        return;
      }

      if (selector !== '' && (!isEmpty(value) || typeof value === 'number')) {
        if (typeof styleKey === 'string') {
          builderHandler(EventBridgeTypes.STYLE_UPDATE_SELECTOR, displayMode, selector, selectorType, styleKey, value);
        } else if (Array.isArray(styleKey)) {
          const newValues = { ...values, ...value };
          Object.keys(newValues).forEach(k => {
            if (newValues[k] === undefined) {
              delete newValues[k];
            }
          });
          builderHandler(EventBridgeTypes.STYLE_UPDATE_SELECTOR, displayMode, selector, selectorType, '', newValues);
        }

        return;
      }

      // // Value empty, remove it
      if (selector !== '') {
        if (styleKey && typeof styleKey === 'string') {
          builderHandler(EventBridgeTypes.STYLE_UPDATE_SELECTOR, displayMode, selector, selectorType, styleKey, value);
        } else if (styleKey && Array.isArray(styleKey)) {
          builderHandler(
            EventBridgeTypes.STYLE_UPDATE_SELECTOR,
            displayMode,
            selector,
            selectorType,
            '',
            omit(values, styleKey)
          );
        }

        return;
      }

      // New selector
      if (!element) {
        return;
      }

      const {
        definition: { type }
      } = element;

      const customClass = makeSelector(type, styleSelector);
      builderHandler(
        EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
        produce(element, draft => {
          set(draft, `definition.styleSelectors.${styleSelector}`, customClass);
        })
      );

      if (styleKey && typeof styleKey === 'string') {
        builderHandler(
          EventBridgeTypes.STYLE_ADD_SELECTOR,
          displayMode,
          customClass,
          StyleSelectors.SELECTOR_CLASS,
          styleKey,
          value
        );
      } else if (styleKey && Array.isArray(styleKey)) {
        builderHandler(
          EventBridgeTypes.STYLE_ADD_SELECTOR,
          displayMode,
          customClass,
          StyleSelectors.SELECTOR_CLASS,
          '',
          value
        );
      }
    },
    [values, displayMode, bindingData, element, builderHandler, builderHandler, selector, selectorType, styleSelector]
  );

  const getDefaultValue = useCallback(key => {
    if (typeof key === 'object') {
      const value = {};
      key.forEach(k => {
        value[k] = get(defaultValue, k);
      });

      return value;
    }

    if (!key) {
      return defaultValue;
    }

    return get(defaultValue, key);
  }, []);

  const resetValue = useCallback(
    keys => {
      if (Array.isArray(keys)) {
        setValue(keys);
      } else {
        setValue(keys);
      }
    },
    [setValue, values]
  );

  const rawValues = get(style, `platform.${displayMode}.${selector}.attributes`);
  const finalValues = useMemo(() => {
    const inheritValues = Object.keys(inheritData?.style ?? {}).reduce(
      (acum, styleKey) => ({ ...acum, [styleKey]: get(inheritData, `style.${styleKey}.0.value`) }),
      {}
    );
    const bindingValues = Object.keys(bindingData?.style ?? {}).reduce(
      (acum, styleKey) => ({ ...acum, [styleKey]: get(bindingData, `style.${styleKey}.0.value`) }),
      {}
    );

    return { ...defaultValue, ...bindingValues, ...inheritValues, ...rawValues };
  }, [rawValues, inheritData, bindingData]);

  const inspectorContextValue = useMemo(
    () => ({
      rawValues: values,
      values: finalValues,
      displayMode,
      selector,
      setValue,
      resetValue,
      inheritData: get(inheritData, 'style', {}),
      bindingData: get(bindingData, 'style', {}),
      getDefaultValue
    }),
    [
      displayMode,
      selector,
      setValue,
      resetValue,
      inheritData,
      bindingData,
      getDefaultValue,
      values,
      finalValues
    ]
  );

  return <StyleInspectorContext value={inspectorContextValue}>{children}</StyleInspectorContext>;
};

export default StyleInspectorProvider;
