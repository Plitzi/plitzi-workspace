import Element from './Element';
import { categoryDisplay } from './ElementHelper';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

export type ElementCategoryProps = {
  components: ComponentDefinition[];
  category: string;
  /** Said above the grid — when a search lists several categories at once. */
  titled?: boolean;
};

/** The elements of one category, as a compact grid to drag from. */
const ElementCategory = ({ components, category, titled = false }: ElementCategoryProps) => {
  const display = categoryDisplay(category);

  return (
    <section className="flex flex-col gap-1" aria-label={display.label}>
      {titled && (
        <span className="px-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-zinc-500">
          {display.label}
        </span>
      )}
      <div className="grid grid-cols-3 gap-1">
        {components.map(component => (
          <Element key={component.definition.type} component={component} />
        ))}
      </div>
    </section>
  );
};

export default ElementCategory;
