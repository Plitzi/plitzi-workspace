import classNames from 'classnames';
import debounce from 'lodash-es/debounce';
import { useState, useEffect, useCallback, useMemo } from 'react';

import type { RefObject } from 'react';

export type ResizeDirection = 'sw' | 'nw' | 'se' | 'ne' | 's' | 'w' | 'e' | 'n';

export type OverlayButtonResizeProps = {
  className?: string;
  width?: number;
  height?: number;
  transformScale?: number; // 0.5 if is centered and expands in both sides
  elementDOM: HTMLElement;
  refIframe?: RefObject<HTMLIFrameElement | null>;
  lockAspectRatio?: boolean;
  minConstraintsX?: number;
  minConstraintsY?: number;
  maxConstraintsX?: number;
  maxConstraintsY?: number;
  resizeHandle?: ResizeDirection;
  axis?: 'both' | 'x' | 'y' | 'none';
  onChange?: (width: number, height: number, isFinal: boolean) => void;
};

const OverlayButtonResize = ({
  className = '',
  width = -1,
  height = -1,
  transformScale = 1, // 0.5 if is centered and expands in both sides
  elementDOM,
  refIframe,
  lockAspectRatio = false,
  minConstraintsX = 50,
  minConstraintsY = 50,
  maxConstraintsX = Infinity,
  maxConstraintsY = Infinity,
  resizeHandle = 'se',
  axis = 'both',
  onChange
}: OverlayButtonResizeProps) => {
  const onChangeDebounced = useMemo(() => onChange && debounce(onChange, 150), [onChange]);
  const [clientX, setClientX] = useState<number>(0);
  const [direction, setDirection] = useState<ResizeDirection | undefined>(undefined);
  const [oWidth, setOWidth] = useState<number>(0);
  const [oHeight, setOHeight] = useState<number>(0);
  const [clientY, setClientY] = useState<number>(0);
  const [refreshHandler, setRefreshHandler] = useState<NodeJS.Timeout | undefined>(undefined);

  const runConstraints = useCallback(
    (auxWidth: number, auxHeight: number, reverse: boolean = false) => {
      // If you do this, be careful of constraints
      const [min, max] = [
        [minConstraintsX, minConstraintsY],
        [maxConstraintsX, maxConstraintsY]
      ];

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

      if (min[0] && min[1]) {
        auxWidth = Math.max(min[0], auxWidth);
        auxHeight = Math.max(min[1], auxHeight);
      }

      if (max[0] && max[1]) {
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
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;
      const deltaX = (x - clientX) / transformScale;
      const deltaY = (y - clientY) / transformScale;
      if (!direction) {
        return;
      }

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
      onChangeDebounced?.(finalWidth, finalHeight, false);
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
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDirection(undefined);
      onChangeDebounced?.(elementDOM.offsetWidth, elementDOM.offsetHeight, true);
      setRefreshHandler(
        setTimeout(() => {
          elementDOM.style.width = '';
          elementDOM.style.height = '';
        }, 1500)
      );
    },
    [elementDOM.offsetHeight, elementDOM.offsetWidth, elementDOM.style, onChangeDebounced]
  );

  const handleMouseDown = (direction: ResizeDirection) => (e: MouseEvent | React.MouseEvent) => {
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
    if (refIframe && refIframe.current) {
      return refIframe.current.contentWindow;
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    return window;
  }, [refIframe]);

  useEffect(() => {
    const win = getWindow();
    if (direction && win) {
      win.addEventListener('mousemove', handleMouseMove, false);
      win.addEventListener('mouseup', handleMouseUp, false);
    }

    return () => {
      if (direction && win) {
        win.removeEventListener('mousemove', handleMouseMove, false);
        win.removeEventListener('mouseup', handleMouseUp, false);
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
