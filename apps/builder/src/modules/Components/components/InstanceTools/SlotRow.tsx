import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { Element } from '@plitzi/sdk-shared';

export type SlotRowProps = {
  child: Element;
  slots: { value: string; label: string }[];
  /** The slot a child naming none goes in: the component's first. */
  fallback?: string;
};

/** One child of an instance, and the slot of the component it fills. */
const SlotRow = ({ child, slots, fallback }: SlotRowProps) => {
  const { eventBridge } = use(EventBridgeContext);
  const { slot } = child.attributes;

  const handleChange = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      if (!option?.value || option.value === slot) {
        return;
      }

      void eventBridge.emit('main', 'schemaUpdateElement', {
        ...child,
        attributes: { ...child.attributes, slot: option.value }
      });
    },
    [eventBridge, child, slot]
  );

  return (
    <Select2
      value={typeof slot === 'string' ? slot : (fallback ?? '')}
      label={child.definition.label}
      onChange={handleChange}
      options={slots}
    />
  );
};

export default SlotRow;
