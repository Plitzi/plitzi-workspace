import Notice from '@pmodules/App/components/Notice';

import AudienceFacts from './components/AudienceFacts';
import ExperimentVariants from './components/ExperimentVariants';
import PageReads from './components/PageReads';
import SimulatedTime from './components/SimulatedTime';
import VisitorPicker from './components/VisitorPicker';

/**
 * Who the canvas shows the page to — the editor's session, a guest or a test account — the facts the space's Variants by
 * rules read, the variant of each by chance, the date, and what the page then reads of its visitor (`auth`).
 */
const VisitorTab = () => (
  <div className="flex flex-col gap-3">
    <VisitorPicker />
    <Notice tone="info">
      The canvas’s preview shows the page to this visitor: in each Variants element, the variant their facts match (by
      rules) or the one chosen below (by chance), and what shows at the date chosen. While editing, each Variants
      element shows the variant its own settings pick.
    </Notice>
    <AudienceFacts />
    <ExperimentVariants />
    <SimulatedTime />
    <PageReads />
  </div>
);

export default VisitorTab;
