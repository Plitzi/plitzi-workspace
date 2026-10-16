import ShadowList from '../../../components/ShadowList';
import { DEFAULT_SHADOW, serializeShadow } from '../../../shadowValue';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BoxShadowProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const BOX_SHADOW_KEYS: StyleCategory[] = ['box-shadow'];

const ADDED = serializeShadow(DEFAULT_SHADOW, { withSpread: true });

const BoxShadow = ({ value, onChange }: BoxShadowProps) => (
  <ShadowList
    label="Box Shadow"
    keys={BOX_SHADOW_KEYS}
    addLabel="Add box shadow"
    withSpread
    added={ADDED}
    value={value}
    onChange={onChange}
  />
);

export default BoxShadow;
