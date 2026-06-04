import { StoreProvider } from '@plitzi/sdk-store';

import ExampleCard from '../ExampleCard';
import DraftBody from './components/DraftBody';
import { DRAFT_CODE } from './draftCode';
import { DRAFT_INITIAL } from './draftStore';

const DraftDemo = () => (
  <ExampleCard
    title="Edit with cancel"
    subtitle='inherit="snapshot" → draft an isolated copy, then save or discard'
    code={DRAFT_CODE}
  >
    <StoreProvider value={DRAFT_INITIAL}>
      <DraftBody />
    </StoreProvider>
  </ExampleCard>
);

export default DraftDemo;
