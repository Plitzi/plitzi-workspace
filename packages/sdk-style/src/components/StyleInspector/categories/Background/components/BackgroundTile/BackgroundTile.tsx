/* eslint-disable quotes */

import BackgroundTileX from '@plitzi/plitzi-ui/icons/BackgroundTileX';
import BackgroundTileXY from '@plitzi/plitzi-ui/icons/BackgroundTileXY';
import BackgroundTileY from '@plitzi/plitzi-ui/icons/BackgroundTileY';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';

import type { BackgroundLayer } from '../../helpers/backgroundParser';

export type BackgroundTileProps = { layer: BackgroundLayer; onChange?: (layer: BackgroundLayer) => void };

const BackgroundTile = ({ layer, onChange }: BackgroundTileProps) => {
  const itemsRepeat = useMemo(
    () => [
      {
        value: 'repeat',
        icon: <BackgroundTileXY />,
        description: 'Horizontally and Vertically',
        active: layer.repeat === 'repeat'
      },
      {
        value: 'repeat-x',
        icon: <BackgroundTileX />,
        description: 'Horizontally',
        active: layer.repeat === 'repeat-x'
      },
      {
        value: 'repeat-y',
        icon: <BackgroundTileY />,
        description: 'Vertically',
        active: layer.repeat === 'repeat-y'
      },
      {
        value: 'no-repeat',
        icon: <XMark />,
        description: "Don't tile",
        active: layer.repeat === 'no-repeat'
      }
    ],
    [layer.repeat]
  );

  const handleRepeatChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, repeat: String(value) }),
    [layer, onChange]
  );

  return (
    <CategorySection label="Tile">
      <CategoryOption type="iconGroup" items={itemsRepeat} onChange={handleRepeatChange} />
    </CategorySection>
  );
};

export default BackgroundTile;
