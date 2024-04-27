// Packages
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import noop from 'lodash/noop';
import debounce from 'lodash/debounce';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   width?: number;
 *   height?: number;
 *   transformScale?: number; // 0.5 if is centered and expands in both sides
 *   elementDOM: object;
 *   iframeDOM: object;
 *   lockAspectRatio?: boolean;
 *   minConstraintsX?: number;
 *   minConstraintsY?: number;
 *   maxConstraintsX?: number;
 *   maxConstraintsY?: number;
 *   resizeHandle?: 'sw' | 'nw' | 'se' | 'ne' | 's' | 'w' | 'e' | 'n';
 *   axis?: 'both' | 'x' | 'y' | 'none';
 *   onChange?: (width: number, height: number, isFinal: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const OverlayButtonResize = props => {
  const {
    className = '',
    width = -1,
    height = -1,
    transformScale = 1,
    elementDOM,
    iframeDOM,
    lockAspectRatio = false,
    minConstraintsX = 50,
    minConstraintsY = 50,
    maxConstraintsX = Infinity,
    maxConstraintsY = Infinity,
    resizeHandle = 'se',
    axis = 'both',
    onChange = noop
  } = props;
  const onChangeDebounced = useMemo(() => debounce(onChange, 150), [onChange]);
  const [clientX, setClientX] = useState(0);
  const [direction, setDirection] = useState(undefined);
  const [oWidth, setOWidth] = useState();
  const [oHeight, setOHeight] = useState();
  const [clientY, setClientY] = useState(0);
  const [refreshHandler, setRefreshHandler] = useState(undefined);

  const runConstraints = useCallback(
    (auxWidth, auxHeight, reverse = false) => {
      // If you do this, be careful of constraints
      const [min, max] = [
        [minConstraintsX, minConstraintsY],
        [maxConstraintsX, maxConstraintsY]
      ];
      if (!min && !max) {
        return [auxWidth, auxHeight];
      }

      // Fit width & height to aspect ratio
      if (lockAspectRatio) {
        if (auxHeight === height) {
          const ratio = width / height;
          auxHeight = auxWidth / ratio;
          auxWidth = auxHeight * ratio;
        } else {
          // Take into account vertical resize with N/S handles on locked aspect
          // ratio. Calculate the change height-first, instead of width-first
          const ratio = height / width;
          auxWidth = auxHeight / ratio;
          auxHeight = auxWidth * ratio;
        }
      }

      if (min) {
        auxWidth = Math.max(min[0], auxWidth);
        auxHeight = Math.max(min[1], auxHeight);
      }

      if (max) {
        auxWidth = Math.min(max[0], auxWidth);
        auxHeight = Math.min(max[1], auxHeight);
      }

      const rect = elementDOM.getBoundingClientRect();

      if (!reverse) {
        if (rect.x + auxWidth > window.innerWidth) {
          auxWidth = window.innerWidth - rect.x;
        }

        if (rect.y + auxHeight > window.innerHeight) {
          auxHeight = window.innerHeight - rect.y;
        }
      }

      return [auxWidth, auxHeight];
    },
    [elementDOM, height, lockAspectRatio, maxConstraintsX, maxConstraintsY, minConstraintsX, minConstraintsY, width]
  );

  const handleMouseMove = useCallback(
    e => {
      e.stopPropagation();
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;
      const deltaX = (x - clientX) / transformScale;
      const deltaY = (y - clientY) / transformScale;

      // Axis restrictions
      const canDragX = (axis === 'both' || axis === 'x') && ['n', 's'].indexOf(direction) === -1;
      const canDragY = (axis === 'both' || axis === 'y') && ['e', 'w'].indexOf(direction) === -1;
      const reverseX = direction.includes('w');
      const reverseY = direction.includes('n');

      let finalWidth = oWidth + (canDragX ? deltaX : 0);
      let finalHeight = oHeight + (canDragY ? deltaY : 0);
      if (reverseX) {
        finalWidth = oWidth - (canDragX ? deltaX : 0);
      }

      if (reverseY) {
        finalHeight = oHeight - (canDragY ? deltaY : 0);
      }

      if (finalWidth === oWidth && finalHeight === oHeight) {
        return;
      }

      // Min and Max
      [finalWidth, finalHeight] = runConstraints(finalWidth, finalHeight, reverseX || reverseY);
      onChangeDebounced(finalWidth, finalHeight, false);
      if (oWidth !== Infinity) {
        elementDOM.style.width = `${finalWidth}px`;
      }

      if (oHeight !== Infinity) {
        elementDOM.style.height = `${finalHeight}px`;
      }
    },
    [axis, clientX, clientY, direction, elementDOM, oHeight, oWidth, onChangeDebounced, runConstraints, transformScale]
  );

  const handleMouseUp = useCallback(
    e => {
      e.stopPropagation();
      e.preventDefault();
      setDirection(undefined);
      onChangeDebounced(elementDOM.offsetWidth, elementDOM.offsetHeight, true);
      setRefreshHandler(
        setTimeout(() => {
          elementDOM.style.width = '';
          elementDOM.style.height = '';
        }, 1500)
      );
    },
    [onChangeDebounced]
  );

  const handleMouseDown = direction => e => {
    if (refreshHandler) {
      clearTimeout(refreshHandler);
      elementDOM.style.width = '';
      elementDOM.style.height = '';
      setRefreshHandler(undefined);
    }

    setDirection(direction);
    setClientX(e.clientX);
    setClientY(e.clientY);
    const { width: currentWidth, height: currentHeight } = elementDOM.getBoundingClientRect();
    if (width === -1) {
      setOWidth(currentWidth);
    } else {
      setOWidth(width);
    }

    if (height === -1) {
      setOHeight(currentHeight);
    } else {
      setOHeight(height);
    }
  };

  const getWindow = useCallback(() => {
    if (iframeDOM) {
      return iframeDOM.contentWindow;
    }

    return window;
  }, [iframeDOM]);

  useEffect(() => {
    if (direction) {
      getWindow().addEventListener('mousemove', handleMouseMove, false);
      getWindow().addEventListener('mouseup', handleMouseUp, false);
    }

    return () => {
      if (direction) {
        getWindow().removeEventListener('mousemove', handleMouseMove, false);
        getWindow().removeEventListener('mouseup', handleMouseUp, false);
      }
    };
  }, [direction, getWindow, handleMouseMove, handleMouseUp]);

  return (
    <button
      type="button"
      className={classNames('overlay__button-resize', className, {
        'resize--top-left': resizeHandle === 'nw',
        'resize--top-right': resizeHandle === 'ne',
        'resize--bottom-left': resizeHandle === 'sw',
        'resize--bottom-right': resizeHandle === 'se'
      })}
      onMouseDown={handleMouseDown(resizeHandle)}
    />
  );
};

export default OverlayButtonResize;
