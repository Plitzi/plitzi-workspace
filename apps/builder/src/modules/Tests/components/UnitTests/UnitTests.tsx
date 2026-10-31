import Button from '@plitzi/plitzi-ui/Button';

import EmptyState from '@pmodules/App/components/EmptyState';
import ViewSection from '@pmodules/App/components/ViewSection';

import UnitTestRow from './components/UnitTestRow';
import { problemsOfTest } from '../../helpers';

import type { UnitTest } from '@plitzi/sdk-shared';
import type { TSpaceUnitTestResult } from '@plitzi/sdk-shared/network';

export type UnitTestsProps = {
  tests: UnitTest[];
  results: TSpaceUnitTestResult[];
  /** What the server said is wrong with the tests as written: a check it names is marked. */
  problems: readonly string[];
  /** Read, never written: a role that does not write the tests. */
  readOnly?: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

/**
 * The space's unit tests: one element each, resolved for a state and its data with no browser — run against the saved
 * document on every save, as the issues are.
 */
const UnitTests = ({ tests, results, problems, readOnly = false, onAdd, onEdit, onRemove }: UnitTestsProps) => (
  <ViewSection
    title="Element checks — unit tests"
    actions={
      tests.length > 0 &&
      !readOnly && (
        <Button size="sm" onClick={onAdd}>
          Add an element check
        </Button>
      )
    }
  >
    {tests.length === 0 && (
      <EmptyState
        icon="fa-solid fa-flask"
        title="No element checks yet"
        description="Say what an element must be in a given situation: shown or hidden, the words it reads, the look it wears. They are checked on every save, in an instant, and a snapshot waits for them."
        action={
          readOnly ? undefined : (
            <Button size="sm" onClick={onAdd}>
              Add an element check
            </Button>
          )
        }
      />
    )}
    {tests.map(test => (
      <UnitTestRow
        key={test.id}
        test={test}
        result={results.find(result => result.id === test.id)}
        problems={problemsOfTest(problems, 'unit', test.id)}
        readOnly={readOnly}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    ))}
  </ViewSection>
);

export default UnitTests;
