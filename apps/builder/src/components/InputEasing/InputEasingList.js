// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';

// Relatives
import InputEasingButton from './InputEasingButton';

const InputEasingList = props => {
  const { className = '', onChange = noop } = props;

  return (
    <div className={classNames('flex flex-col border-r border-gray-300', className)}>
      <div className="flex flex-col">
        <div className="bg-blue-400 p-1 text-white text-xs">Default</div>
        <div className="flex flex-wrap">
          <InputEasingButton title="Linear" onClick={() => onChange('linear')}>
            <path d="M30,0 C22.5,7.5 7.5,22.5 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease" onClick={() => onChange('ease')}>
            <path d="M30,0 C7.5,0 7.5,27 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease-in" onClick={() => onChange('ease-in')}>
            <path d="M30,0 C30,0 12.6,30 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease-out" onClick={() => onChange('ease-out')}>
            <path d="M30,0 C17.4,0 0,30 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease-in-out" onClick={() => onChange('ease-in-out')}>
            <path d="M30,0 C17.4,0 12.6,30 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="bg-blue-400 p-1 text-white text-xs">Ease In</div>
        <div className="flex flex-wrap">
          <InputEasingButton title="Ease In Quad" onClick={() => onChange('easeInQuad')}>
            <path
              d="M30,0 C20.400000000000002,14.1 16.5,27.45 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
          <InputEasingButton title="Ease In Cubic" onClick={() => onChange('easeInCubic')}>
            <path d="M30,0 C20.25,24.3 16.5,28.35 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Quart" onClick={() => onChange('easeInQuart')}>
            <path d="M30,0 C25.65,28.2 22.65,28.5 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Quint" onClick={() => onChange('easeInQuint')}>
            <path d="M30,0 C25.65,28.2 22.65,28.5 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Sine" onClick={() => onChange('easeInSine')}>
            <path d="M30,0 C22.35,8.55 14.1,30 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Expo" onClick={() => onChange('easeInExpo')}>
            <path d="M30,0 C23.85,28.95 28.5,28.5 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Circ" onClick={() => onChange('easeInCirc')}>
            <path d="M30,0 C29.4,19.95 18,28.8 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Back" onClick={() => onChange('easeInBack')}>
            <path d="M30,0 C22.05,28.65 18,38.4 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="bg-blue-400 p-1 text-white text-xs">Ease Out</div>
        <div className="flex flex-wrap">
          <InputEasingButton title="Ease Out Quad" onClick={() => onChange('easeOutQuad')}>
            <path
              d="M30,0 C13.5,1.8000000000000007 7.5,16.2 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
          <InputEasingButton title="Ease Out Cubic" onClick={() => onChange('easeOutCubic')}>
            <path d="M30,0 C10.649999999999999,0 6.45,11.7 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease Out Quart" onClick={() => onChange('easeOutQuart')}>
            <path d="M30,0 C13.2,0 4.95,4.800000000000001 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease Out Quint" onClick={() => onChange('easeOutQuint')}>
            <path d="M30,0 C9.6,0 6.9,0 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease Out Sine" onClick={() => onChange('easeOutSine')}>
            <path
              d="M30,0 C16.95,0 11.700000000000001,12.75 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
          <InputEasingButton title="Ease Out Expo" onClick={() => onChange('easeOutExpo')}>
            <path d="M30,0 C6.6,0 5.7,0 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease Out Circ" onClick={() => onChange('easeOutCirc')}>
            <path d="M30,0 C4.95,0 2.25,5.400000000000002 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease Out Back" onClick={() => onChange('easeOutBack')}>
            <path
              d="M30,0 C9.6,-8.25 5.25,3.4499999999999993 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="bg-blue-400 p-1 text-white text-xs">Ease In Out</div>
        <div className="flex flex-wrap">
          <InputEasingButton title="Ease In Out Quad" onClick={() => onChange('easeInOutQuad')}>
            <path
              d="M30,0 C15.450000000000001,1.3500000000000014 13.65,29.1 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
          <InputEasingButton title="Ease In Out Cubic" onClick={() => onChange('easeInOutCubic')}>
            <path
              d="M30,0 C10.649999999999999,0 19.35,28.65 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
          <InputEasingButton title="Ease In Out Quart" onClick={() => onChange('easeInOutQuart')}>
            <path d="M30,0 C5.25,0 23.1,30 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Out Quint" onClick={() => onChange('easeInOutQuint')}>
            <path d="M30,0 C2.1,0 25.8,30 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Out Sine" onClick={() => onChange('easeInOutSine')}>
            <path d="M30,0 C16.5,1.5 13.35,28.5 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Out Expo" onClick={() => onChange('easeInOutExpo')}>
            <path d="M30,0 C0,0 30,30 0,30" className="fill-transparent stroke-2 stroke-current" />
          </InputEasingButton>
          <InputEasingButton title="Ease In Out Circ" onClick={() => onChange('easeInOutCirc')}>
            <path
              d="M30,0 C4.5,4.199999999999999 23.55,25.95 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
          <InputEasingButton title="Ease In Out Back" onClick={() => onChange('easeInOutBack')}>
            <path
              d="M30,0 C7.95,-16.5 20.400000000000002,46.5 0,30"
              className="fill-transparent stroke-2 stroke-current"
            />
          </InputEasingButton>
        </div>
      </div>
    </div>
  );
};

InputEasingList.propTypes = {
  className: PropTypes.string,
  onChange: PropTypes.func
};

export default InputEasingList;
