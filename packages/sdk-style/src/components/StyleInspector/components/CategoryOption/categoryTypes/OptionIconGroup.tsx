import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import { useCallback, useMemo } from 'react';

import type { ReactNode } from 'react';

export type OptionIconGroupProps = {
  items?: { icon: ReactNode; value: string; description?: string; isVisible?: boolean; active?: boolean }[];
  onChange?: (value: string) => void;
};

const OptionIconGroup = ({ items = [], onChange }: OptionIconGroupProps) => {
  const itemsParsed = useMemo(
    () => items.filter(item => typeof item.isVisible !== 'boolean' || !!item.isVisible),
    [items]
  );

  const handleChange = useCallback((value: string) => () => onChange?.(value), [onChange]);

  return (
    <IconGroup className="w-full">
      {itemsParsed.map((item, i) => (
        <IconGroup.Icon
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
