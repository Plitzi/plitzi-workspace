import Icon from '@plitzi/plitzi-ui/Icon';
import PlitziLogo from '@plitzi/plitzi-ui/icons/PlitziLogo';
import Text from '@plitzi/plitzi-ui/Text';

import useDragElement from './hooks/useDragElement';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

export type ElementProps = {
  component: ComponentDefinition;
};

const Element = ({
  component: {
    market: { icon },
    definition: { label, type }
  }
}: ElementProps) => {
  const { onDragStart } = useDragElement({ type });

  return (
    <div className="flex cursor-grabbing flex-col items-center gap-2" draggable onDragStart={onDragStart} title={label}>
      <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border border-gray-300 bg-white p-1.5 dark:border-zinc-600 dark:bg-zinc-800">
        {icon && typeof icon === 'string' && !icon.startsWith('http') && <Icon intent="custom" icon={icon} />}
        {icon && typeof icon === 'string' && icon.startsWith('http') && (
          <Icon intent="custom">
            <img src={icon} draggable={false} />
          </Icon>
        )}
        {icon && typeof icon !== 'string' && <Icon intent="custom">{icon}</Icon>}
        {!icon && (
          <Icon intent="custom">
            <PlitziLogo />
          </Icon>
        )}
      </div>
      <div className="flex w-20 items-center justify-center overflow-hidden text-center">
        <Text isTruncated size="xs">
          {label}
        </Text>
      </div>
    </div>
  );
};

export default Element;
