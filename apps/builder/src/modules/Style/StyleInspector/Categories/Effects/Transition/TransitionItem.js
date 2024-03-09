// Packages
import React, { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import Input from '@plitzi/plitzi-ui-components/Input';

// Alias
import InputEasing from '@pcomponents/InputEasing';
import InputEasingList from '@pcomponents/InputEasing/InputEasingList';
import { easingGenerics } from '@pcomponents/InputEasing/InputEasingHelper';
import InspectorButton from '@pmodules/Style/components/InspectorButton';
import Icons from '@pcomponents/Icons';

// Relatives
import InspectorLabel from '../../../InspectorLabel';
import GroupButtons from '../../../../components/GroupButtons';

const TransitionItem = props => {
  const { value = '', onRemove = noop, onChange = noop } = props;
  const [progress, setProgress] = useState(0);
  const [loopHandler, setLoopHandler] = useState();

  const handleChangeEasing = useCallback(type => value => handleChange({ type, value }), []);

  const handleChangeEasingNative = useCallback(type => e => handleChange({ type, value: e.target.value }), []);

  const handleClickEaseAnimation = () => {
    if (loopHandler) {
      clearInterval(loopHandler);
      setLoopHandler(undefined);
      setProgress(0);

      return;
    }

    setLoopHandler(
      setInterval(() => {
        setProgress(state => {
          if (state + 0.005 <= 1) {
            state += 0.005;
          } else {
            state = 0;
          }

          return state;
        });
      }, 10)
    );
  };

  const valueParts = value.split(/ (?![^()]*\))/gim);
  let { property = 'opacity', duration = '0ms', easing = 'ease', delay = '0ms' } = {};
  if (valueParts.length === 4) {
    [property, duration, easing, delay] = valueParts;
  }

  const valueRef = useRef(value);
  valueRef.current = { property, duration, easing, delay };

  const handleChange = useCallback(
    itemValue => {
      const { type, value } = itemValue;
      const valueAux = { ...valueRef.current };
      if (type === 'easing' && value.includes(',')) {
        valueAux[type] = value.split(',');
      } else if (type === 'easing' && Array.isArray(value)) {
        valueAux[type] = `cubic-bezier(${value[0]}, ${value[1]}, ${value[2]}, ${value[3]})`;
      } else {
        valueAux[type] = value;
      }

      const { duration, delay, property, easing } = valueAux;
      onChange(`${property} ${duration} ${easing} ${delay}`);
    },
    [onChange]
  );

  const items = useMemo(
    () => [
      {
        type: 'select',
        value: property,
        extraValue: { type: 'property' },
        children: (
          <>
            <optgroup label="Common">
              <option value="opacity">Opacity</option>
              <option value="margin">Margin</option>
              <option value="padding">Padding</option>
              <option value="border">Border</option>
              <option value="transform">Transform</option>
              <option value="filter">Filter</option>
              <option value="flex">Flex</option>
            </optgroup>
            <optgroup label="Background">
              <option value="background-color">Background Color</option>
              <option value="background-position">Background Position</option>
              <option value="text-shadow">Text Shadow</option>
              <option value="box-shadow">Box Shadow</option>
            </optgroup>
            <optgroup label="Size">
              <option value="width">Width</option>
              <option value="height">Height</option>
              <option value="max-width">Max Width</option>
              <option value="max-height">Max Height</option>
              <option value="min-width">Min Width</option>
              <option value="min-height">Min Height</option>
            </optgroup>
            <optgroup label="Borders">
              <option value="border-radius">Border Radius</option>
              <option value="border-color">Border Color</option>
              <option value="border-width">Border Width</option>
            </optgroup>
            <optgroup label="Typography">
              <option value="font-color">Font Color</option>
              <option value="font-size">Font Size</option>
              <option value="line-height">Line Height</option>
              <option value="letter-spacing">Letter Spacing</option>
              <option value="text-indent">Text Indent</option>
              <option value="word-spacing">Word Spacing</option>
            </optgroup>
            <optgroup label="Position">
              <option value="top">Top</option>
              <option value="left">Left</option>
              <option value="bottom">Bottom</option>
              <option value="right">Right</option>
              <option value="z-index">Z Index</option>
            </optgroup>
            <optgroup label="Margin">
              <option value="margin-bottom">Margin Bottom</option>
              <option value="margin-left">Margin Left</option>
              <option value="margin-right">Margin RIght</option>
              <option value="margin-top">Margin Top</option>
            </optgroup>
            <optgroup label="Padding">
              <option value="padding-bottom">Padding Bottom</option>
              <option value="padding-left">Padding Left</option>
              <option value="padding-right">Padding Right</option>
              <option value="padding-top">Padding Top</option>
            </optgroup>
            <optgroup label="Flex">
              <option value="flex-grow">Flex Grow</option>
              <option value="flex-shrink">Flex Shrink</option>
              <option value="flex-basis">Flex Basis</option>
            </optgroup>
            <optgroup label="Advanced">
              <option value="all">All Properties</option>
            </optgroup>
          </>
        )
      }
    ],
    [property]
  );

  const itemsTime = useMemo(
    () => [
      {
        type: 'inputMetric',
        inputProps: { emptyValue: '0ms', defaultMetric: 'ms', typeMetric: 'time' },
        value: duration,
        extraValue: { type: 'duration' },
        label: 'Duration'
      },
      {
        type: 'inputMetric',
        inputProps: { emptyValue: '0ms', defaultMetric: 'ms', typeMetric: 'time' },
        value: delay,
        extraValue: { type: 'delay' },
        label: 'Delay'
      }
    ],
    []
  );

  if (easingGenerics[easing]) {
    easing = easingGenerics[easing];
  } else {
    easing = easing.match(/[0-9.]+/gim);
  }

  return (
    <Dropdown
      showIcon={false}
      className="w-full border bg-white rounded border-gray-300 not-first:mt-2 hover:bg-gray-100"
      backgroundDisabled
      closeOnClick={false}
    >
      <Dropdown.Content className="w-full px-2 py-1 flex justify-between">
        <div className="flex items-center">{`${property} ${duration} after ${delay}`}</div>
        <div className="flex">
          <InspectorButton onClick={onRemove} intent="danger" title="Remove">
            <i className="fas fa-trash-alt" />
          </InspectorButton>
        </div>
      </Dropdown.Content>
      <Dropdown.Container className="w-[260px]">
        <div className="flex flex-col p-2 gap-2">
          <GroupButtons
            className="w-full"
            classNameContainer="w-[160px]"
            items={items}
            label="Property"
            onChange={handleChange}
          />
          <GroupButtons
            className="w-full !justify-end"
            classNameContainer="w-[160px]"
            items={itemsTime}
            label=""
            onChange={handleChange}
          />
          <div className="flex w-full justify-between">
            <InspectorLabel>Easing</InspectorLabel>
            <div className="flex w-[160px] gap-2">
              <Dropdown
                showIcon={false}
                containerLeftOffset={-92}
                containerTopOffset={154}
                backgroundDisabled
                closeOnClick={false}
              >
                <Dropdown.Content>
                  <InspectorButton>
                    <Icons
                      type="EffectsTransitionEase"
                      width={26}
                      height={26}
                      className="border rounded p-0.5 border-gray-300"
                    />
                  </InspectorButton>
                </Dropdown.Content>
                <Dropdown.Container className="w-[260px] h-[350px] flex items-center">
                  <InputEasingList className="w-[260px]" onChange={handleChangeEasing('easing')} />
                  <div className="flex flex-col m-2">
                    <div className="flex" onClick={handleClickEaseAnimation}>
                      <InspectorButton>
                        {!loopHandler && <i className="fas fa-play" />}
                        {loopHandler && <i className="fas fa-pause" />}
                      </InspectorButton>
                      <InspectorLabel label={!loopHandler ? 'Play' : 'Pause'} />
                    </div>
                    <InputEasing
                      value={easing}
                      onChange={handleChangeEasing('easing')}
                      progress={progress}
                      height={200}
                      width={200}
                      handleStroke={3}
                      handleRadius={6}
                    />
                  </div>
                </Dropdown.Container>
              </Dropdown>
              <Input
                className="grow w-full"
                inputClassName="rounded"
                type="text"
                size="sm"
                value={easing}
                onChange={handleChangeEasingNative}
              />
            </div>
          </div>
        </div>
      </Dropdown.Container>
    </Dropdown>
  );
};

TransitionItem.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onRemove: PropTypes.func
};

export default TransitionItem;
