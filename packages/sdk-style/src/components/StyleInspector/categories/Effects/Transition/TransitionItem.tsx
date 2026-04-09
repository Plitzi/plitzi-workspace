import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import EffectsTransitionEase from '@plitzi/plitzi-ui/icons/EffectsTransitionEase';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useRef, useState } from 'react';

import InputEasing from '../../../../InputEasing';
import { easingGenerics } from '../../../../InputEasing/InputEasingHelper';
import InputEasingList from '../../../../InputEasing/InputEasingList';
import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import InspectorLabel from '../../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type TransitionItemProps = {
  value?: string;
  onChange?: (value: string) => void;
  onRemove?: (e: MouseEvent) => void;
};

const TransitionItem = ({ value = '', onRemove, onChange }: TransitionItemProps) => {
  const [progress, setProgress] = useState(0);
  const [loopHandler, setLoopHandler] = useState<NodeJS.Timeout | undefined>(undefined);

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

  const valueRef = useRef({ property, duration, easing, delay });
  valueRef.current = { property, duration, easing, delay };

  const handleChange = useCallback(
    (type: 'property' | 'easing' | 'duration' | 'delay') =>
      (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        const valueAux = { ...valueRef.current };
        if (type === 'easing' && (itemValue as string).includes(',')) {
          const parts = (itemValue as string).split(',');
          valueAux[type] = `cubic-bezier(${parts[0]}, ${parts[1]}, ${parts[2]}, ${parts[3]})`;
        } else if (type === 'easing' && Array.isArray(itemValue)) {
          valueAux[type] = `cubic-bezier(${itemValue[0]}, ${itemValue[1]}, ${itemValue[2]}, ${itemValue[3]})`;
        } else {
          valueAux[type] = itemValue as string;
        }

        const { duration, delay, property, easing } = valueAux;
        console.log('called', type, easing, itemValue);
        onChange?.(`${property} ${duration} ${easing} ${delay}`);
      },
    [onChange]
  );

  const handleChangeEasingNative = useCallback((val: string) => handleChange('easing')(val), [handleChange]);

  let easingValue: [number, number, number, number] = [] as unknown as [number, number, number, number];
  if (easing in easingGenerics) {
    easingValue = easingGenerics[easing];
  } else {
    easingValue = easing.match(/[0-9.]+/gim) as unknown as [number, number, number, number];
  }

  return (
    <ContainerFloating className="w-full" closeOnClick={false}>
      <ContainerFloating.Trigger className="flex w-full cursor-pointer items-center justify-between rounded-sm border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-0.5 select-none hover:bg-gray-100 dark:hover:bg-zinc-700/60">
        <div className="flex items-center">{`${property} ${duration} after ${delay}`}</div>
        <div className="flex">
          <Icon size="xs" icon="fas fa-trash-alt" onClick={onRemove} intent="danger" title="Remove" />
        </div>
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="w-[260px]">
        <div className="flex w-full flex-col gap-2 p-2">
          <CategorySection label="Property">
            <CategoryOption onChange={handleChange('property')} type="select" value={property}>
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
            </CategoryOption>
          </CategorySection>
          <CategorySection>
            <CategoryOption
              label="Duration"
              value={duration}
              onChange={handleChange('duration')}
              type="metric"
              units={[{ label: 'MS', value: 'ms' }]}
              min={0}
            />
            <CategoryOption
              label="Delay"
              value={delay}
              onChange={handleChange('delay')}
              type="metric"
              units={[{ label: 'MS', value: 'ms' }]}
              min={0}
            />
          </CategorySection>
          <CategorySection label="Easing">
            <ContainerFloating containerLeftOffset={-92} containerTopOffset={154} closeOnClick={false}>
              <ContainerFloating.Trigger>
                <Icon className="rounded-sm border border-gray-300 dark:border-zinc-600 p-0.5" size="xl">
                  <EffectsTransitionEase />
                </Icon>
              </ContainerFloating.Trigger>
              <ContainerFloating.Content className="flex h-[456px] w-[260px] flex-col items-center overflow-y-auto">
                <InputEasingList className="w-[260px]" onChange={handleChange('easing')} />
                <div className="m-2 flex flex-col">
                  <div className="flex" onClick={handleClickEaseAnimation}>
                    <Icon icon={loopHandler ? 'fas fa-pause' : 'fas fa-play'} />
                    <InspectorLabel>{!loopHandler ? 'Play' : 'Pause'}</InspectorLabel>
                  </div>
                  <InputEasing
                    value={easingValue}
                    // onChange={handleChange('easing')}
                    progress={progress}
                    height={200}
                    width={200}
                    // handleStroke={3}
                    handleRadius={6}
                  />
                </div>
              </ContainerFloating.Content>
            </ContainerFloating>
            <Input
              className="w-full grow"
              type="text"
              size="xs"
              value={easingValue.toString()}
              readOnly
              onChange={handleChangeEasingNative}
            />
          </CategorySection>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default TransitionItem;
