// Packages
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import get from 'lodash/get';

// Alias
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';

/**
 * @param {{
 *   id?: string;
 *   hoverRemove?: boolean;
 *   selector?: string;
 *   hasItems?: boolean;
 *   iframeDOM?: object;
 *   elementDOM?: object;
 *   displayMode?: 'desktop' | 'tablet' | 'mobile';
 *   zoom?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const OverlaySpacing = props => {
  const {
    id = '',
    hoverRemove = false,
    selector,
    hasItems = false,
    iframeDOM,
    elementDOM,
    displayMode = 'desktop',
    zoom = 1
  } = props;
  const [rawStyle, setRawStyle] = useState({});
  const { style } = useContext(BuilderStyleContext);
  const elementStyle = useMemo(() => {
    if (!selector) {
      return {};
    }

    return get(style, `platform.${displayMode}.${selector}.attributes`, {});
  }, [style, displayMode, selector]);

  const getStyle = () => {
    if (!elementDOM) {
      return [];
    }

    if (iframeDOM) {
      return iframeDOM.contentWindow.getComputedStyle(elementDOM);
    }

    return window.getComputedStyle(elementDOM);
  };

  useEffect(() => {
    setRawStyle(getStyle());
  }, [
    id,
    elementStyle['margin-top'],
    elementStyle['margin-bottom'],
    elementStyle['margin-left'],
    elementStyle['margin-right'],
    elementStyle['padding-top'],
    elementStyle['padding-bottom'],
    elementStyle['padding-left'],
    elementStyle['padding-right']
  ]);

  const calculateWidth = useCallback((distance, mode = 'rest', correction = '0px') => {
    if (distance === '0px') {
      return '0px';
    }

    if (!correction || correction === '0px') {
      return distance;
    }

    return `calc(${distance} ${mode === 'sum' ? '+' : '-'} ${correction})`;
  }, []);

  const calculateSpacingMemo = useMemo(() => {
    const { marginTop, marginBottom, marginLeft, marginRight, paddingTop, paddingBottom, paddingLeft, paddingRight } =
      rawStyle;

    const overlayCorrection = '2px';

    return {
      margin: {
        top: {
          height: marginTop,
          top: calculateWidth(`-${marginTop}`, 'rest', overlayCorrection)
        },
        bottom: {
          height: marginBottom,
          bottom: calculateWidth(`-${marginBottom}`, 'rest', overlayCorrection)
        },
        left: {
          width: marginLeft,
          left: calculateWidth(`-${marginLeft}`, 'rest', overlayCorrection)
        },
        right: {
          width: marginRight,
          right: calculateWidth(`-${marginRight}`, 'rest', overlayCorrection)
        }
      },
      padding: {
        top: { height: calculateWidth(paddingTop, 'rest', overlayCorrection) },
        bottom: { height: calculateWidth(paddingBottom, 'rest', overlayCorrection) },
        left: {
          width: calculateWidth(paddingLeft, 'rest', overlayCorrection),
          top: `calc(${paddingTop} - ${overlayCorrection})`,
          height: `calc(100% - ${paddingBottom} - ${paddingTop} + ${overlayCorrection} * 2)`
        },
        right: {
          width: calculateWidth(paddingRight, 'rest', overlayCorrection),
          top: `calc(${paddingTop} - ${overlayCorrection})`,
          height: `calc(100% - ${paddingBottom} - ${paddingTop} + ${overlayCorrection} * 2)`
        }
      }
    };
  }, [rawStyle, zoom]);

  return (
    <div className="overlay__spacing">
      <div className="margin--top" style={calculateSpacingMemo.margin.top} />
      <div className="margin--bottom" style={calculateSpacingMemo.margin.bottom} />
      <div className="margin--left" style={calculateSpacingMemo.margin.left} />
      <div className="margin--right" style={calculateSpacingMemo.margin.right} />

      <div className="padding--top" style={calculateSpacingMemo.padding.top} />
      <div className="padding--bottom" style={calculateSpacingMemo.padding.bottom} />
      <div className="padding--left" style={calculateSpacingMemo.padding.left} />
      <div className="padding--right" style={calculateSpacingMemo.padding.right} />

      {hoverRemove && hasItems && (
        <div
          className="overlay__delete-message-container"
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom left' }}
        >
          <div className="overlay__delete-message">This element will be removed</div>
        </div>
      )}
    </div>
  );
};

export default OverlaySpacing;
