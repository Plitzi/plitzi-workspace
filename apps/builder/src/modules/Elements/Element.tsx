import Icon from '@plitzi/plitzi-ui/Icon';
import PlitziLogo from '@plitzi/plitzi-ui/icons/PlitziLogo';

import { summaryOf } from './ElementHelper';
import useDragElement from './hooks/useDragElement';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

export type ElementProps = {
  component: ComponentDefinition;
};

/** One element of the catalog, dragged onto the canvas or into Layers: its icon, its whole name, what it is on hover. */
const Element = ({ component }: ElementProps) => {
  const {
    market: { icon },
    definition: { label, type }
  } = component;
  const { onDragStart } = useDragElement({ type });
  const summary = summaryOf(component);

  return (
    <div
      className="group flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-transparent px-1 py-2 text-center transition-colors hover:border-gray-200 hover:bg-gray-50 active:cursor-grabbing dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
      draggable
      onDragStart={onDragStart}
      title={summary ? `${label} — ${summary}` : label}
    >
      <div className="group-hover:bg-primary-50 group-hover:text-primary-600 dark:group-hover:bg-primary-400/15 dark:group-hover:text-primary-300 flex size-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition-colors dark:bg-zinc-800 dark:text-zinc-300">
        {icon && typeof icon === 'string' && !icon.startsWith('http') && <Icon intent="custom" icon={icon} />}
        {icon && typeof icon === 'string' && icon.startsWith('http') && (
          <Icon intent="custom">
            <img src={icon} draggable={false} alt="" />
          </Icon>
        )}
        {icon && typeof icon !== 'string' && <Icon intent="custom">{icon}</Icon>}
        {!icon && (
          <Icon intent="custom">
            <PlitziLogo />
          </Icon>
        )}
      </div>
      <span className="line-clamp-2 w-full text-[11px] leading-tight break-words text-gray-700 dark:text-zinc-300">
        {label}
      </span>
    </div>
  );
};

export default Element;
