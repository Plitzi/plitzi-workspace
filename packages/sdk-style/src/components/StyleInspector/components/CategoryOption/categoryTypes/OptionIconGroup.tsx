import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import { useCallback, useMemo } from 'react';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type OptionIconGroupProps = {
  items?: {
    icon: ReactNode;
    value: StyleValue | Record<StyleCategory, StyleValue> | boolean;
    description?: string;
    isVisible?: boolean;
    active?: boolean;
    size?: 'md' | 'sm' | 'xs' | 'custom';
  }[];
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const OptionIconGroup = ({ items = [], onChange }: OptionIconGroupProps) => {
  const itemsParsed = useMemo(
    () => items.filter(item => typeof item.isVisible !== 'boolean' || item.isVisible),
    [items]
  );

  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => () => onChange?.(value),
    [onChange]
  );

  return (
    <IconGroup className="w-full" gap={1} size="xs">
      {itemsParsed.map((item, i) => (
        <IconGroup.Icon
          size={item.size}
          className="cursor-pointer"
          active={item.active}
          key={i}
          onClick={handleChange(item.value)}
          icon={typeof item.icon === 'string' ? item.icon : undefined}
        >
          {typeof item.icon !== 'string' && item.icon}
        </IconGroup.Icon>
      ))}
    </IconGroup>
  );
};

export default OptionIconGroup;
