// Packages
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

export const LIMIT_MODE_PARENT = 'parent';
export const LIMIT_MODE_WINDOW = 'window';
export const LIMIT_MODE_NONE = 'none';

const NodeDraggable = props => {
  const {
    x = 0,
    y = 0,
    limitMode = LIMIT_MODE_WINDOW,
    children,
    className = '',
    updateOnDragging = false,
    onPositionChanged = noop,
    ...otherProps
  } = props;
  const elementRef = useRef(null);
  const xRef = useRef(x);
  const yRef = useRef(y);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(x);
  const [offsetY, setOffsetY] = useState(y);
  const [TX, setTX] = useState(0);
  const [TY, setTY] = useState(0);
  const [containerRect, setContainerRect] = useState({});
  const [, setReRender] = useState(false);

  const handleMouseMove = e => {
    e.stopPropagation();
    e.preventDefault();
    if (dragging) {
      const rect = elementRef.current.getBoundingClientRect();
      let newX = offsetX + e.clientX - TX;
      let newY = offsetY + e.clientY - TY;
      if (newX + rect.width > containerRect.width && limitMode !== LIMIT_MODE_NONE) {
        newX = containerRect.width - rect.width;
      } else if (newX < 0) {
        newX = 0;
      }

      if (newY + rect.height > containerRect.height && limitMode !== LIMIT_MODE_NONE) {
        newY = containerRect.height - rect.height;
      } else if (newY < 0) {
        newY = 0;
      }

      xRef.current = newX;
      yRef.current = newY;

      elementRef.current.style.left = `${newX}px`;
      elementRef.current.style.top = `${newY}px`;

      if (updateOnDragging) {
        onPositionChanged(newX, newY);
      }
    }
  };

  const handleMouseUp = e => {
    e.stopPropagation();
    e.preventDefault();
    if (offsetX !== xRef.current || offsetY !== yRef.current) {
      onPositionChanged(xRef.current, yRef.current);
    }

    setDragging(false);
    setOffsetX(xRef.current);
    setOffsetY(yRef.current);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove, false);
      window.addEventListener('mouseup', handleMouseUp, false);

      window.addEventListener('touchmove', handleTouchMove, false);
      window.addEventListener('touchend', handleTouchEnd, false);
    }

    return () => {
      if (dragging) {
        window.removeEventListener('mousemove', handleMouseMove, false);
        window.removeEventListener('mouseup', handleMouseUp, false);

        window.removeEventListener('touchmove', handleTouchMove, false);
        window.removeEventListener('touchend', handleTouchEnd, false);
      }
    };
  }, [dragging, containerRect]);

  useLayoutEffect(() => {
    if (xRef.current !== x || yRef.current !== y) {
      xRef.current = x;
      yRef.current = y;
      setOffsetX(x);
      setOffsetY(y);
      setTX(0);
      setTY(0);
      setReRender(state => !state);
    }
  }, [x, y]);

  const handleMouseDown = e => {
    let rect = {};
    if (limitMode === LIMIT_MODE_PARENT) {
      if (!elementRef.current || !elementRef.current.parentNode) {
        rect = { height: window.innerHeight, width: window.innerWidth };
      }

      rect = elementRef.current.parentNode.getBoundingClientRect();
    } else {
      rect = { height: window.innerHeight, width: window.innerWidth };
    }

    if (e.button === 0) {
      setDragging(true);
      setContainerRect(rect);
      setTX(e.clientX);
      setTY(e.clientY);
    } else {
      setDragging(false);
      setOffsetX(xRef.current);
      setOffsetY(yRef.current);
    }
  };

  const handleTouchMove = e => {
    e.stopPropagation();
    if (e.changedTouches.length > 1) {
      e.preventDefault();
    }

    if (dragging) {
      const rect = elementRef.current.getBoundingClientRect();
      const { clientX, clientY } = e.touches[0];
      let newX = offsetX + clientX - TX;
      let newY = offsetY + clientY - TY;
      if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width;
      } else if (newX < 0) {
        newX = 0;
      }

      if (newY + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height;
      } else if (newY < 0) {
        newY = 0;
      }

      xRef.current = newX;
      yRef.current = newY;

      elementRef.current.style.left = `${newX}px`;
      elementRef.current.style.top = `${newY}px`;

      if (updateOnDragging) {
        onPositionChanged(newX, newY);
      }
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    setOffsetX(xRef.current);
    setOffsetY(yRef.current);
    onPositionChanged(xRef.current, yRef.current);
  };

  const handleTouchStart = e => {
    e.stopPropagation();
    setDragging(true);
    setTX(e.touches[0].clientX);
    setTY(e.touches[0].clientY);
  };

  return (
    <div
      className={classNames('flex absolute cursor-move select-none', className)}
      ref={elementRef}
      style={{ top: yRef.current, left: xRef.current }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      {...otherProps}
    >
      {children}
    </div>
  );
};

NodeDraggable.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  x: PropTypes.number,
  y: PropTypes.number,
  limitMode: PropTypes.oneOf([LIMIT_MODE_WINDOW, LIMIT_MODE_PARENT, LIMIT_MODE_NONE]),
  updateOnDragging: PropTypes.bool,
  onPositionChanged: PropTypes.func
};

export default NodeDraggable;
