import Element from './Element';
import { categoryDisplay } from './ElementHelper';

import type { CatalogEntry } from './ElementHelper';

export type ElementCategoryProps = {
  components: CatalogEntry[];
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
        <span className="text-ui-fg-subtle px-1 text-[11px] font-semibold tracking-wide uppercase">
          {display.label}
        </span>
      )}
      <div className="grid grid-cols-3 gap-1">
        {components.map(({ definition, partOf }) => (
          <Element key={definition.definition.type} component={definition} partOf={partOf} />
        ))}
      </div>
    </section>
  );
};

export default ElementCategory;
