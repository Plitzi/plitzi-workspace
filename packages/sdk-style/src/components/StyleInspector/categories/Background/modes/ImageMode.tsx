import { useCallback } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import { asText } from '../../../cssValues';

import type { BackgroundLayer } from '../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type ImageModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

const ImageMode = ({ layer, onChange }: ImageModeProps) => {
  const handleUrlChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => onChange?.({ ...layer, url: asText(value) }),
    [layer, onChange]
  );

  return <CategoryOption label="URL" type="input" value={layer.url} onChange={handleUrlChange} />;
};

export default ImageMode;
