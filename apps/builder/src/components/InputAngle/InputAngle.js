// Packages
import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import InputMetric from '@plitzi/plitzi-ui-components/InputMetric';

/**
 * @param {{
 *   className?: string;
 *   value?: number;
 *   width?: number;
 *   height?: number;
 *   min?: number;
 *   max?: number;
 *   step?: number;
 *   onChange?: (value: number) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const InputAngle = props => {
  const {
    className = '',
    value: valueProp = 0,
    width = 40,
    height = 40,
    min = 0,
    max = 360,
    step = 1,
    onChange = noop
  } = props;
  const value = useRef(valueProp);
  const inputRef = useRef();
  const dotRef = useRef();

  useEffect(() => {
    value.current = valueProp;
  }, [valueProp]);

  const radToDeg = rad => rad * (180 / Math.PI);

  const getCenter = element => {
    const rect = element.getBoundingClientRect();

    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  };

  const angle = (vector, element) => {
    const center = getCenter(element);
    const x = vector[0] - center[0];
    const y = vector[1] - center[1];
    let deg = radToDeg(Math.atan2(x, y));
    deg -= 90;
    if (deg < 0) {
      deg += 360;
    }

    return deg;
  };

  const normalize = degree => {
    const n = Math.max(min, Math.min(degree, max));
    const high = Math.ceil(n / step);
    const low = Math.round(n / step);
    if (high >= n / step) {
      return high * step === 360 ? 0 : high * step;
    }

    return low * step;
  };

  const handleMouseMove = e => {
    e.stopPropagation();
    e.preventDefault();
    const vector = [e.x, e.y];
    const deg = angle(vector, inputRef.current);
    const newValue = normalize(deg);
    value.current = newValue;

    dotRef.current.style.transform = `rotate(-${newValue}deg)`;
  };

  const handleMouseUp = e => {
    e.stopPropagation();
    e.preventDefault();
    if (valueProp !== value.current) {
      onChange(value.current);
    }

    window.removeEventListener('mousemove', handleMouseMove, false);
    window.removeEventListener('mouseup', handleMouseUp, false);
  };

  const handleMouseDown = () => {
    window.addEventListener('mousemove', handleMouseMove, false);
    window.addEventListener('mouseup', handleMouseUp, false);
  };

  const handleKeyDown = e => {
    e.preventDefault();
    let dir = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrorRight') {
      dir = 1;
    } else if (e.key === 'ArrowDown' || e.key === 'ArrorLeft') {
      dir = -1;
    } else {
      return;
    }

    let val = value + dir * step;
    if (val === max + 1) {
      val = min;
    }

    if (val === min - 1) {
      val = max - 1;
    }

    val = normalize(val);
    onChange(val);
  };

  const handleChange = val => onChange(parseFloat(val));

  return (
    <div className={classNames('flex justify-between items-center', className)}>
      <div
        ref={inputRef}
        className="relative border border-gray-300 bg-gray-100 mr-2 rounded-full cursor-pointer outline-hidden"
        style={{ width, minWidth: width, height, minHeight: height }}
      >
        <span
          className="h-px absolute left-0 right-0 top-1/2 before:content-[''] before:right-[3px] before:top-1/2 before:absolute before:rounded-full before:translate-y-[-50%] before:h-2.5 before:w-2.5 before:bg-blue-400"
          style={{ transform: `rotate(-${valueProp}deg)` }}
          ref={dotRef}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
        />
      </div>
      <InputMetric
        onChange={handleChange}
        value={`${valueProp}`}
        suffix="deg"
        minValue={0}
        maxValue={360}
        emptyValue="0"
        className="rounded-sm"
      />
    </div>
  );
};

export default InputAngle;
