import { useMemo } from 'react';

import ExportChangeGroup from './components/ExportChangeGroup';
import { groupCorrections } from '../../helpers/repairs';

import type { SpecCorrection } from '@plitzi/sdk-authoring';

export type ExportChangesProps = {
  corrections: SpecCorrection[];
};

/**
 * What the export tidied while reading the space, one change per row.
 *
 * Grouped by kind under a heading that folds it away, every change on its own line with the names in it set in code —
 * so where one ends and the next begins is never a question. Nothing here is wrong with the space: these are the
 * leftovers an older builder wrote that today's code has no word for.
 */
const ExportChanges = ({ corrections }: ExportChangesProps) => {
  const groups = useMemo(() => groupCorrections(corrections), [corrections]);

  return (
    <div className="h-full overflow-auto">
      <p className="border-ui-line text-ui-fg-subtle border-b px-4 py-3 text-xs">
        Leftovers an older builder wrote, tidied on the way. The code still builds the same page.
      </p>
      {groups.map(group => (
        <ExportChangeGroup key={group.code} group={group} />
      ))}
    </div>
  );
};

export default ExportChanges;
