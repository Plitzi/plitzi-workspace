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
      className="group hover:border-ui-line hover:bg-ui-hover flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-transparent px-1 py-2 text-center transition-colors active:cursor-grabbing"
      draggable
      onDragStart={onDragStart}
      title={summary ? `${label} — ${summary}` : label}
    >
      <div className="group-hover:bg-primary-50 group-hover:text-primary-600 dark:group-hover:bg-primary-400/15 dark:group-hover:text-primary-300 bg-ui-raised text-ui-fg-muted flex size-9 shrink-0 items-center justify-center rounded-md transition-colors">
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
      <span className="text-ui-fg line-clamp-2 w-full text-[11px] leading-tight break-words">{label}</span>
    </div>
  );
};

export default Element;
