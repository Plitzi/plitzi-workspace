import { useCallback, useMemo } from 'react';

import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';
import { asText } from '../../../../cssValues';

import type { BackgroundLayer } from '../../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BackgroundAttachmentProps = { layer: BackgroundLayer; onChange?: (layer: BackgroundLayer) => void };

/** Whether the layer scrolls with the element, with its content, or stays put while the page moves under it. */
const BackgroundAttachment = ({ layer, onChange }: BackgroundAttachmentProps) => {
  const items = useMemo(
    () => [
      {
        value: 'scroll',
        icon: <span className="px-1.5 text-xs select-none">Scroll</span>,
        description: 'Scrolls with the element',
        active: layer.attachment === 'scroll',
        size: 'custom' as const
      },
      {
        value: 'local',
        icon: <span className="px-1.5 text-xs select-none">Local</span>,
        description: 'Scrolls with the element’s content',
        active: layer.attachment === 'local',
        size: 'custom' as const
      },
      {
        value: 'fixed',
        icon: <span className="px-1.5 text-xs select-none">Fixed</span>,
        description: 'Stays put while the page scrolls',
        active: layer.attachment === 'fixed',
        size: 'custom' as const
      }
    ],
    [layer.attachment]
  );

  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.({ ...layer, attachment: asText(value) }),
    [layer, onChange]
  );

  return (
    <CategorySection label="Attachment">
      <CategoryOption type="iconGroup" items={items} onChange={handleChange} />
    </CategorySection>
  );
};

export default BackgroundAttachment;
