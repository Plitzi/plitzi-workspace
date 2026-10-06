import { finding } from '../catalog';

import type { Rule } from '../types';

export const unusedFile: Rule = ({ unreached, entry }) =>
  unreached.map(file =>
    finding(
      'unused-file',
      `Nothing ${entry} imports reaches this file, so it is not part of the space: import it where it belongs, or delete it — git keeps the history.`,
      { file, line: 1, column: 1 }
    )
  );
