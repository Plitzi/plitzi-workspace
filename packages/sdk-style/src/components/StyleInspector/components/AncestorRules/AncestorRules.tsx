import { memo } from 'react';

import AncestorRuleChip from './AncestorRuleChip';

import type { AncestorCondition } from '../../helpers';
import type { StyleState } from '@plitzi/sdk-shared';

export type AncestorRulesProps = {
  conditions: AncestorCondition[];
  unused: Set<string>;
  activeAncestor?: string;
  activeState?: StyleState;
  activeVariant?: string;
  onSelect?: (condition: AncestorCondition) => void;
  onRemove?: (condition: AncestorCondition) => void;
  onRemoveUnused?: () => void;
};

/** The rules a selector has under its ancestors, each one a chip to jump to or remove, the dead ones flagged. */
const AncestorRules = ({
  conditions,
  unused,
  activeAncestor,
  activeState,
  activeVariant,
  onSelect,
  onRemove,
  onRemoveUnused
}: AncestorRulesProps) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
      <span>
        <i className="fas fa-sitemap mr-1" />
        Ancestor rules ({conditions.length})
      </span>
      {unused.size > 0 && (
        <button
          type="button"
          className="text-amber-700 hover:underline dark:text-amber-300"
          title="Remove every rule under an ancestor no element this selector dresses sits inside, at every breakpoint"
          onClick={onRemoveUnused}
        >
          Remove unused ({unused.size})
        </button>
      )}
    </div>
    <div className="flex flex-wrap gap-1">
      {conditions.map(condition => (
        <AncestorRuleChip
          key={`${condition.ancestor}:${condition.label}`}
          condition={condition}
          active={
            condition.ancestor === activeAncestor &&
            condition.state === activeState &&
            condition.variant === activeVariant
          }
          unused={unused.has(condition.ancestor)}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  </div>
);

export default memo(AncestorRules);
