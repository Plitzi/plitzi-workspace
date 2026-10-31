import { useMemo } from 'react';

import { e2eTestProblems, unitTestProblems } from '@plitzi/sdk-authoring';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { E2eTest, SpaceTests } from '@plitzi/sdk-shared';

/**
 * What is wrong with the space's tests as they are written, read here against the document as it is being edited — the
 * same reading a snapshot makes (sdk-authoring's), so what the builder says and what a snapshot refuses agree: an edit
 * that fixes a test fixes it at once, and the answer does not hang on the server's version. The flow being written is
 * read as it stands, saved or not.
 */
const useTestProblems = (tests: SpaceTests, flow?: E2eTest): string[] => {
  const [schema] = useBuilderStore('schema');

  return useMemo(() => {
    const saved = tests.e2e ?? [];
    const flows = flow
      ? saved.some(each => each.id === flow.id)
        ? saved.map(each => (each.id === flow.id ? flow : each))
        : [...saved, flow]
      : saved;

    return [...unitTestProblems(schema, tests.unit ?? []), ...e2eTestProblems(schema, flows, tests.unit ?? [])];
  }, [flow, schema, tests]);
};

export default useTestProblems;
