import Button from '@plitzi/plitzi-ui/Button';

import EmptyState from '@pmodules/App/components/EmptyState';
import ViewSection from '@pmodules/App/components/ViewSection';

import E2eTestRow from './components/E2eTestRow';

import type { E2eTest } from '@plitzi/sdk-shared';
import type { TSpaceRunE2eTestsMutation } from '@plitzi/sdk-shared/network';

export type E2eTestsProps = {
  tests: E2eTest[];
  /** The last time they were played on the draft; none until they are. */
  run?: TSpaceRunE2eTestsMutation;
  running: boolean;
  onRun: () => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onView: (id: string) => void;
};

/** The space's e2e tests: a page opened as a visitor would, its steps played, what must hold checked as they go. */
const E2eTests = ({ tests, run, running, onRun, onAdd, onEdit, onRemove, onView }: E2eTestsProps) => (
  <ViewSection
    title="E2E tests — flows"
    actions={
      tests.length > 0 && (
        <div className="flex gap-2">
          <Button size="sm" intent="secondary" disabled={running} onClick={onRun}>
            {running ? 'Playing…' : 'Run e2e tests'}
          </Button>
          <Button size="sm" onClick={onAdd}>
            Add e2e test
          </Button>
        </div>
      )
    }
  >
    {tests.length === 0 && (
      <EmptyState
        icon="fa-solid fa-route"
        title="No e2e tests yet"
        description="Play what a visitor does — click, type, go to a page — and say what the page must show after each step. Elements are named by their id, so a restyle never breaks a test."
        action={
          <Button size="sm" onClick={onAdd}>
            Add e2e test
          </Button>
        }
      />
    )}
    {tests.map(test => (
      <E2eTestRow
        key={test.id}
        test={test}
        result={run?.results.find(result => result.id === test.id)}
        notRun={run?.notRun ?? undefined}
        onEdit={onEdit}
        onRemove={onRemove}
        onView={onView}
      />
    ))}
  </ViewSection>
);

export default E2eTests;
