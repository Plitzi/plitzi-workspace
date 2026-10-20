import { logicGuide } from './logic';
import { practiceGuide } from './practice';
import { referenceGuide } from './reference';
import { serverGuide } from './server';
import { structureGuide } from './structure';
import { stylingGuide } from './styling';

export { guideQuickstart, serverInstructions, widgetsOnlyInstructions } from './instructions';

/** The full reference, `plitzi://guide`: its sections in order, each a module. */
export const guideText = [referenceGuide, stylingGuide, logicGuide, serverGuide, structureGuide, practiceGuide].join(
  ''
);
