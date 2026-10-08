import { memo, useCallback, useMemo, useRef } from 'react';

import { asText } from '../../cssValues';
import { parseShadow, serializeShadow } from '../../shadowValue';
import CategoryOption from '../CategoryOption';
import ColorSwatch from '../ColorSwatch';
import ValueListItem from '../ValueListItem';

import type { Shadow } from '../../shadowValue';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type ShadowItemProps = {
  value: string;
  /** A box shadow's: `inset` and `spread`. A text shadow has neither. */
  withSpread: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

/**
 * One shadow of a list, edited part by part. One the editor cannot read as parts — a token for the whole shadow — is
 * edited as the text it is, never replaced by a default.
 */
const ShadowItem = ({ value, withSpread, onChange, onRemove }: ShadowItemProps) => {
  const shadow = parseShadow(value);
  const shadowRef = useRef(shadow);
  shadowRef.current = shadow;

  const handleChange = useCallback(
    (part: Exclude<keyof Shadow, 'inset'>) => (partValue: OptionValue) => {
      const current = shadowRef.current;
      if (current) {
        onChange(serializeShadow({ ...current, [part]: asText(partValue) }, { withSpread }));
      }
    },
    [onChange, withSpread]
  );

  const handleChangeType = useCallback(
    (type: OptionValue) => {
      const current = shadowRef.current;
      if (current) {
        onChange(serializeShadow({ ...current, inset: type === 'inset' }, { withSpread }));
      }
    },
    [onChange, withSpread]
  );

  const handleChangeRaw = useCallback((raw: OptionValue) => onChange(asText(raw)), [onChange]);

  const typeItems = useMemo(
    () => [
      {
        value: 'outset',
        icon: <span className="px-1.5 text-xs select-none">Outside</span>,
        description: 'Cast outside the box',
        active: !shadow?.inset,
        size: 'custom' as const
      },
      {
        value: 'inset',
        icon: <span className="px-1.5 text-xs select-none">Inside</span>,
        description: 'Cast inside the box',
        active: !!shadow?.inset,
        size: 'custom' as const
      }
    ],
    [shadow?.inset]
  );

  const title = withSpread ? 'Box shadow' : 'Text shadow';

  return (
    <ValueListItem
      summary={value}
      preview={shadow && <ColorSwatch className="h-4 w-4" value={shadow.color} />}
      title={title}
      removeLabel={`Remove ${title.toLowerCase()}`}
      onRemove={onRemove}
    >
      {!shadow && (
        <>
          <CategoryOption label="Value" type="input" value={value} onChange={handleChangeRaw} />
          <p className="m-0 text-[11px] text-zinc-500 dark:text-zinc-400">
            Not a single shadow the editor can split into parts (a token, for one), so it is edited as written.
          </p>
        </>
      )}
      {shadow && withSpread && (
        <CategoryOption label="Type" type="iconGroup" items={typeItems} onChange={handleChangeType} />
      )}
      {shadow && (
        <div className="grid grid-cols-2 gap-2">
          <CategoryOption
            label="X offset"
            type="metric"
            value={shadow.x}
            min={-Infinity}
            onChange={handleChange('x')}
          />
          <CategoryOption
            label="Y offset"
            type="metric"
            value={shadow.y}
            min={-Infinity}
            onChange={handleChange('y')}
          />
          <CategoryOption label="Blur" type="metric" value={shadow.blur} min={0} onChange={handleChange('blur')} />
          {withSpread && (
            <CategoryOption
              label="Spread"
              type="metric"
              value={shadow.spread}
              min={-Infinity}
              onChange={handleChange('spread')}
            />
          )}
        </div>
      )}
      {shadow && <CategoryOption label="Color" type="color" value={shadow.color} onChange={handleChange('color')} />}
    </ValueListItem>
  );
};

export default memo(ShadowItem);
