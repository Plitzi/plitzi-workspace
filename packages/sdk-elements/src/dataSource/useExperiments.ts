import { useEffect, useMemo, useRef } from 'react';

import {
  assignExperiments,
  builderExperiments,
  declaredExperiments,
  forcedExperimentsFor,
  keptExperiments,
  writeExperiments
} from '@plitzi/sdk-shared/experiments';
import { documentCookies } from '@plitzi/sdk-shared/helpers';
import { useStableValue } from '@plitzi/sdk-shared/hooks';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import type { ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

const pageHost = (): string | undefined => (typeof window === 'undefined' ? undefined : window.location.host);

/**
 * The variant each of the space's A/B tests shows this visitor — what `{{ experiments.<name> }}` reads.
 *
 * The server's first: it drew the page with them, and a page hydrated with any other would be thrown away. Then what
 * the visitor kept in their cookie, then a draw for an experiment none of those has — a space rendered with no server
 * in front, or a part of it the server never sent — kept from then on, in this render and in the cookie. Over them, what
 * a tester forced (the dev tools, `?ab=`), shown and never kept. In the builder nothing is drawn or kept: the canvas
 * shows the variant each test's settings name, and in its preview what the Simulate visitor panel forces over them.
 */
const useExperiments = (): ExperimentAssignments => {
  const [[flat, components, serverExperiments, qa]] = useCommonStore([
    'schema.flat',
    'schema.components',
    'experiments.server',
    'experiments.qa'
  ]);
  const { builder, previewMode } = useRenderSettings();
  // Editing in the builder, each test shows its own `builderVariant` and nothing forces it.
  const editing = builder && !previewMode;
  const declared = useMemo(() => declaredExperiments({ flat, components }), [flat, components]);
  // What this page drew before, so a later render — a part of the space arriving — never draws the same one again.
  const drawnBefore = useRef<ExperimentAssignments>({});
  const assignment = useMemo(() => {
    if (builder) {
      return { assignments: builderExperiments(declared), kept: {}, drawn: [] };
    }

    const kept = { ...keptExperiments(documentCookies(), pageHost()), ...drawnBefore.current, ...serverExperiments };

    return assignExperiments(declared, kept);
  }, [builder, declared, serverExperiments]);
  // Written during render, like `useStableValue`, and only with what the render produced.
  for (const name of assignment.drawn) {
    drawnBefore.current[name] = assignment.assignments[name];
  }

  const { drawn, kept } = assignment;
  useEffect(() => {
    if (drawn.length > 0) {
      // Over what the cookie holds already: a page sent in parts declares only the experiments of what it has.
      writeExperiments({ ...keptExperiments(documentCookies(), pageHost()), ...kept });
    }
  }, [drawn, kept]);

  const forced = useMemo(() => forcedExperimentsFor(declared, editing ? {} : (qa ?? {})), [declared, editing, qa]);
  // A tester told what they forced and cannot be shown — an experiment this space does not run, a variant its test
  // has not — once per change in what is ignored.
  const ignored = useStableValue(forced.ignored);
  useEffect(() => {
    ignored.forEach(({ name, variant, reason }) =>
      console.warn(
        reason === 'undeclared'
          ? `[plitzi] "${name}" is forced to ${variant.toUpperCase()}, but no A/B test of this space runs it: ignored. Name an experiment one of its tests runs.`
          : `[plitzi] "${name}" is forced to ${variant.toUpperCase()}, a variant its A/B test does not have: ignored. Force one it has.`
      )
    );
  }, [ignored]);

  return useMemo(
    () =>
      Object.keys(forced.applied).length > 0
        ? { ...assignment.assignments, ...forced.applied }
        : assignment.assignments,
    [assignment.assignments, forced]
  );
};

export default useExperiments;
