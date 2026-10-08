import { useCallback } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import { asText } from '../../../cssValues';

import type { BackgroundLayer } from '../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type RawModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

/** A layer the editor has no controls for — a token, `image-set()` — written as the CSS it is. */
const RawMode = ({ layer, onChange }: RawModeProps) => {
  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => onChange?.({ ...layer, raw: asText(value) }),
    [layer, onChange]
  );

  return (
    <>
      <CategoryOption label="CSS" type="input" value={layer.raw} onChange={handleChange} />
      <p className="m-0 text-[11px] text-zinc-500 dark:text-zinc-400">
        Any image CSS accepts: a token such as var(--hero-bg), image-set(…), cross-fade(…).
      </p>
    </>
  );
};

export default RawMode;
