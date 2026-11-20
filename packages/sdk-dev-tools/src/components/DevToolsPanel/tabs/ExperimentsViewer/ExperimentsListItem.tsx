import clsx from 'clsx';
import { useCallback } from 'react';

import { variantAt } from '@plitzi/sdk-shared/experiments';

import type { ExperimentVariant } from '@plitzi/sdk-shared/experiments';

export type ExperimentsListItemProps = {
  name: string;
  /** Each variant's weight, A first. */
  weights: number[];
  /** The variant this page shows. */
  shown?: ExperimentVariant;
  /** What a tester forced, if anything. */
  forced?: ExperimentVariant;
  onForce: (name: string, variant: ExperimentVariant | undefined) => void;
};

type VariantButtonProps = {
  name: string;
  variant: ExperimentVariant;
  weight: number;
  forced: boolean;
  onForce: ExperimentsListItemProps['onForce'];
};

const VariantButton = ({ name, variant, weight, forced, onForce }: VariantButtonProps) => {
  const handleClick = useCallback(() => onForce(name, variant), [name, variant, onForce]);

  return (
    <button
      type="button"
      className={clsx('rounded px-1.5 py-0.5 font-mono text-[10px] font-medium', {
        'bg-violet-600 text-white': forced,
        'text-ui-fg-subtle hover:bg-ui-hover': !forced
      })}
      title={`Force variant ${variant.toUpperCase()} (weight ${String(weight)}) for this browser`}
      onClick={handleClick}
    >
      {variant.toUpperCase()}
    </button>
  );
};

const ExperimentsListItem = ({ name, weights, shown, forced, onForce }: ExperimentsListItemProps) => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights
    .map((weight, index) => {
      const variant = variantAt(index);

      return variant ? `${variant.toUpperCase()} ${String(total > 0 ? Math.round((weight / total) * 100) : 0)}%` : '';
    })
    .join(' · ');

  const handleClear = useCallback(() => onForce(name, undefined), [name, onForce]);

  return (
    <div className="border-ui-line hover:bg-ui-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-3 py-1.5 transition-colors">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-ui-fg truncate font-mono font-medium" title={name}>
            {name}
          </span>
          {shown && (
            <span className="text-ui-fg-muted bg-ui-raised rounded px-1 font-mono text-[10px]">
              shows {shown.toUpperCase()}
              {forced ? ' · forced' : ''}
            </span>
          )}
        </div>
        <span className="text-ui-fg-subtle truncate text-[11px]">{shares}</span>
      </div>
      <div className="flex items-center gap-1">
        {weights.map((weight, index) => {
          const variant = variantAt(index);

          return (
            variant && (
              <VariantButton
                key={variant}
                name={name}
                variant={variant}
                weight={weight}
                forced={forced === variant}
                onForce={onForce}
              />
            )
          );
        })}
        {forced !== undefined && (
          <button
            type="button"
            className="text-ui-fg-subtle hover:bg-ui-hover rounded px-1.5 py-0.5 text-[10px]"
            title="Stop forcing it: the visitor's own variant shows again"
            onClick={handleClear}
          >
            <i className="fa-solid fa-rotate-left" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ExperimentsListItem;
