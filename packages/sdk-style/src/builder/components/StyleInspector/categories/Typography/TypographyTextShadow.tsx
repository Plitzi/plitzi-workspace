import ShadowList from '../../components/ShadowList';
import { DEFAULT_SHADOW, serializeShadow } from '../../shadowValue';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyTextShadowProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TEXT_SHADOW_KEYS: StyleCategory[] = ['text-shadow'];

const ADDED = serializeShadow({ ...DEFAULT_SHADOW, y: '1px', blur: '2px' }, { withSpread: false });

const TypographyTextShadow = ({ value, onChange }: TypographyTextShadowProps) => (
  <ShadowList
    label="Text Shadow"
    keys={TEXT_SHADOW_KEYS}
    addLabel="Add text shadow"
    withSpread={false}
    added={ADDED}
    value={value}
    onChange={onChange}
  />
);

export default TypographyTextShadow;
