import { useCallback, useRef } from 'react';

import {
  isListedProperty,
  parseTransition,
  serializeTransition,
  TRANSITION_PROPERTY_GROUPS,
  transitionSummary
} from './helpers';
import TransitionEasing from './TransitionEasing';
import CategoryOption from '../../../components/CategoryOption';
import ValueListItem from '../../../components/ValueListItem';
import { asText } from '../../../cssValues';

import type { TransitionValue } from './helpers';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TransitionItemProps = {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

const TIME_UNITS = [
  { label: 'MS', value: 'ms' },
  { label: 'S', value: 's' }
];

/** One transition of the list. One the editor cannot read as parts — a token for it — is edited as written. */
const TransitionItem = ({ value, onRemove, onChange }: TransitionItemProps) => {
  const transition = parseTransition(value);
  const transitionRef = useRef(transition);
  transitionRef.current = transition;

  const handleChange = useCallback(
    (part: keyof TransitionValue) => (partValue: OptionValue) => {
      const current = transitionRef.current;
      if (current) {
        onChange(serializeTransition({ ...current, [part]: asText(partValue) }));
      }
    },
    [onChange]
  );

  const handleChangeEasing = useCallback((easing: string) => handleChange('easing')(easing), [handleChange]);

  const handleChangeRaw = useCallback((raw: OptionValue) => onChange(asText(raw)), [onChange]);

  const summary = transition ? transitionSummary(transition) : value;

  return (
    <ValueListItem summary={summary} title="Transition" removeLabel="Remove transition" onRemove={onRemove}>
      {!transition && (
        <>
          <CategoryOption label="Value" type="input" value={value} onChange={handleChangeRaw} />
          <p className="m-0 text-[11px] text-zinc-500 dark:text-zinc-400">
            Not a single transition the editor can split into parts (a token, for one), so it is edited as written.
          </p>
        </>
      )}
      {transition && (
        <CategoryOption label="Property" type="select" value={transition.property} onChange={handleChange('property')}>
          {!isListedProperty(transition.property) && (
            <optgroup label="Current">
              <option value={transition.property}>{transition.property}</option>
            </optgroup>
          )}
          {TRANSITION_PROPERTY_GROUPS.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </CategoryOption>
      )}
      {transition && (
        <div className="grid grid-cols-2 gap-2">
          <CategoryOption
            label="Duration"
            type="metric"
            value={transition.duration}
            units={TIME_UNITS}
            min={0}
            onChange={handleChange('duration')}
          />
          <CategoryOption
            label="Delay"
            type="metric"
            value={transition.delay}
            units={TIME_UNITS}
            min={-Infinity}
            onChange={handleChange('delay')}
          />
        </div>
      )}
      {transition && <TransitionEasing value={transition.easing} onChange={handleChangeEasing} />}
    </ValueListItem>
  );
};

export default TransitionItem;
