import useInspectorValues from '../../hooks/useInspectorValues';

import type { StyleCategory } from '@plitzi/sdk-shared';

export type InspectorDotsProps = {
  styleKeys?: StyleCategory[];
};

/** The same four sources a row's label is tinted by, summed up for a whole category while it is folded. */
const InspectorDots = ({ styleKeys }: InspectorDotsProps) => {
  const { hasInherit, hasBinding, hasVariables, hasValues } = useInspectorValues({ keys: styleKeys, asValue: false });

  return (
    <div className="flex items-center gap-1.5">
      {hasValues && (
        <div className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400" title="Has values set on this selector" />
      )}
      {hasVariables && (
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" title="Uses tokens" />
      )}
      {hasBinding && (
        <div className="h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400" title="Has values bound to data" />
      )}
      {hasInherit && (
        <div
          className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400"
          title="Inherits values from elsewhere"
        />
      )}
    </div>
  );
};

export default InspectorDots;
