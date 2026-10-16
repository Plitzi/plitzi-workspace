import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type SizeContainerProps = {
  containerType?: StyleValue;
  containerName?: StyleValue;
  onChange?: (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

/**
 * Whether the element is a container its children measure themselves against — a container query, the `cqw` units —
 * by its width (`inline-size`) or both sides (`size`), and the name a query asks for it by.
 */
const SizeContainer = ({ containerType, containerName, onChange }: SizeContainerProps) => (
  <CategorySection label="">
    <CategoryOption
      keys={['container-type']}
      label="Container"
      value={containerType}
      onChange={onChange?.('container-type')}
      type="select"
    >
      <option value="normal">None</option>
      <option value="inline-size">Width</option>
      <option value="size">Width and height</option>
    </CategoryOption>
    <CategoryOption
      keys={['container-name']}
      label="Container name"
      value={containerName}
      onChange={onChange?.('container-name')}
      type="input"
    />
  </CategorySection>
);

export default SizeContainer;
