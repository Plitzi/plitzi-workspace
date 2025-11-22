import React, { Component, createRef } from 'react';
import clsx from 'clsx';
import noop from 'lodash-es/noop';

import Grid from './Grid';
import Progress from './Progress';
import Curve from './Curve';

const valueDefault = [0.25, 0.25, 0.75, 0.75];
const paddingDefault = [25, 5, 25, 18];

/**
 * @param {{
 *   className?: string;
 *   value?: number[];
 *   width?: number;
 *   height?: number;
 *   handleRadius?: number;
 *   padding?: number[];
 *   progress?: number;
 *   readOnly?: boolean;
 *   onChange?: (value: number[]) => void;
 * }} props
 * @returns {React.ReactElement}
 */
class InputEasing extends Component {
  constructor(props) {
    super(props);

    this.state = {
      inputRef: createRef(),
      handle: undefined
    };
  }

  positionForEvent = e => {
    const { inputRef } = this.state;
    const rect = inputRef.current.getBoundingClientRect();

    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  x = value => {
    const { padding = paddingDefault, width = 300 } = this.props;
    const w = width - padding[1] - padding[3];

    return Math.round(padding[3] + value * w);
  };

  inversex = x => {
    const { padding = paddingDefault, width = 300 } = this.props;
    const w = width - padding[1] - padding[3];

    return Math.max(0, Math.min((x - padding[3]) / w, 1));
  };

  y = value => {
    const { padding = paddingDefault, height = 300 } = this.props;
    const h = height - padding[0] - padding[2];

    return Math.round(padding[0] + (1 - value) * h);
  };

  inversey = y => {
    const { height = 300, handleRadius = 5, padding = paddingDefault } = this.props;
    const clampMargin = 2 * handleRadius;
    const h = height - padding[0] - padding[2];
    y = Math.max(clampMargin, Math.min(y, height - clampMargin));

    return 1 - (y - padding[0]) / h;
  };

  handleMouseDown = handle => e => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({
      handle
    });

    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  };

  handleMouseMove = e => {
    const { onChange = noop } = this.props;
    let { value = valueDefault } = this.props;
    const { handle } = this.state;
    e.preventDefault();

    let i = 0;
    if (handle === 'top') {
      i = 2;
    }

    value = [].concat(value);
    const [x, y] = this.positionForEvent(e);
    value[i] = this.inversex(x).toFixed(2);
    value[i + 1] = this.inversey(y).toFixed(2);
    onChange(value);
  };

  handleMouseUp = () => {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  };

  render() {
    const {
      children,
      value = valueDefault,
      width = 300,
      height = 300,
      handleRadius = 5,
      className = '',
      progress = 0,
      readOnly = false
    } = this.props;

    const { inputRef } = this.state;

    const sharedProps = {
      xFrom: this.x(0),
      yFrom: this.y(0),
      xTo: this.x(1),
      yTo: this.y(1)
    };

    const sx1 = this.x(0);
    const sy1 = this.y(0);
    const cx1 = this.x(value[0]);
    const cy1 = this.y(value[1]);
    const a1 = Math.atan2(cy1 - sy1, cx1 - sx1);
    const cxs1 = cx1 - handleRadius * Math.cos(a1);
    const cys1 = cy1 - handleRadius * Math.sin(a1);

    const sx2 = this.x(1);
    const sy2 = this.y(1);
    const cx2 = this.x(value[2]);
    const cy2 = this.y(value[3]);
    const a2 = Math.atan2(cy2 - sy2, cx2 - sx2);
    const cxs2 = cx2 - handleRadius * Math.cos(a2);
    const cys2 = cy2 - handleRadius * Math.sin(a2);

    return (
      <svg
        className={clsx('overflow-visible select-none', className)}
        ref={inputRef}
        width={width}
        height={height}
      >
        <Grid {...sharedProps} />
        <Progress {...sharedProps} value={value} progress={progress} />
        <Curve {...sharedProps} value={value} />
        {children}
        {!readOnly && (
          <>
            <g className="group">
              <line
                x1={cxs1}
                y1={cys1}
                x2={sx1}
                y2={sy1}
                className="stroke-blue-400 stroke-[3px] group-hover:stroke-[4px]"
              />
              <circle
                cx={cx1}
                cy={cy1}
                r={handleRadius}
                onMouseDown={this.handleMouseDown('bottom')}
                className="cursor-pointer fill-blue-400 stroke-blue-400 stroke-[3px] group-hover:fill-white group-hover:stroke-[6px]"
              />
            </g>
            <g className="group">
              <line
                x1={cxs2}
                y1={cys2}
                x2={sx2}
                y2={sy2}
                className="stroke-blue-400 stroke-[3px] group-hover:stroke-[4px]"
              />
              <circle
                cx={cx2}
                cy={cy2}
                r={handleRadius}
                onMouseDown={this.handleMouseDown('top')}
                className="cursor-pointer fill-blue-400 stroke-blue-400 stroke-[3px] group-hover:fill-white group-hover:stroke-[6px]"
              />
            </g>
          </>
        )}
      </svg>
    );
  }
}

export default InputEasing;
