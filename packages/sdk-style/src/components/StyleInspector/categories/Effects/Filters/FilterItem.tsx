import { useCallback, useRef } from 'react';

import { FILTER_GROUPS, FILTER_SPECS, parseFilter, serializeFilter } from './helpers';
import CategoryOption from '../../../components/CategoryOption';
import ValueListItem from '../../../components/ValueListItem';
import { asText } from '../../../cssValues';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type FilterItemProps = {
  value: string;
  title: string;
  onChange: (value: string) => void;
  onRemove: () => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

const FILTER_ENTRIES = Object.entries(FILTER_SPECS);

/**
 * One function of a filter list. The ones without a control here — `drop-shadow(…)`, `url(#…)`, a token — are edited
 * as the text they are.
 */
const FilterItem = ({ value, title, onRemove, onChange }: FilterItemProps) => {
  const filter = parseFilter(value);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const spec = filter ? FILTER_SPECS[filter.name] : undefined;

  const handleChangeName = useCallback(
    (name: OptionValue) => {
      const fn = asText(name);
      if (!Object.hasOwn(FILTER_SPECS, fn)) {
        return;
      }

      // A new function starts at its own default: 5px of blur means nothing to a sepia.
      onChange(serializeFilter({ name: fn, amount: FILTER_SPECS[fn].default }));
    },
    [onChange]
  );

  const handleChangeAmount = useCallback(
    (amount: OptionValue) => {
      if (filterRef.current) {
        onChange(serializeFilter({ ...filterRef.current, amount: asText(amount) }));
      }
    },
    [onChange]
  );

  const handleChangeRaw = useCallback((raw: OptionValue) => onChange(asText(raw)), [onChange]);

  return (
    <ValueListItem summary={value} title={title} removeLabel={`Remove ${title.toLowerCase()}`} onRemove={onRemove}>
      {!filter && (
        <>
          <CategoryOption label="Value" type="input" value={value} onChange={handleChangeRaw} />
          <p className="m-0 text-[11px] text-zinc-500 dark:text-zinc-400">
            A function the editor has no control for, so it is edited as written.
          </p>
        </>
      )}
      {filter && spec && (
        <div className="grid grid-cols-2 gap-2">
          <CategoryOption label="Function" type="select" value={filter.name} onChange={handleChangeName}>
            {FILTER_GROUPS.map(group => (
              <optgroup key={group} label={group}>
                {FILTER_ENTRIES.filter(([, entry]) => entry.group === group).map(([name, entry]) => (
                  <option key={name} value={name}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </CategoryOption>
          <CategoryOption
            label="Amount"
            type="metric"
            value={filter.amount}
            units={spec.units}
            step={spec.step}
            min={filter.name === 'hue-rotate' ? -Infinity : 0}
            onChange={handleChangeAmount}
          />
        </div>
      )}
    </ValueListItem>
  );
};

export default FilterItem;
