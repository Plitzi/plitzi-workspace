import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import clsx from 'clsx';
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
    <IconGroup className="w-full px-1.5 py-1" gap={1} size="md">
      {itemsParsed.map((item, i) => (
        <IconGroup.Icon
          size={item.size}
          className={clsx('cursor-pointer rounded-sm p-0.5', {
            'bg-zinc-300 dark:bg-zinc-800': item.active,
            'text-xs': typeof item.icon === 'string',
            'h-5 w-5': item.size !== 'custom'
          })}
          active={item.active}
          key={i}
          onClick={handleChange(item.value)}
          icon={typeof item.icon === 'string' ? item.icon : undefined}
          title={item.description}
        >
          {typeof item.icon !== 'string' && item.icon}
        </IconGroup.Icon>
      ))}
    </IconGroup>
  );
};

export default OptionIconGroup;
