import { useEffect, useMemo, useRef } from 'react';

import {
  assignExperiments,
  builderExperiments,
  declaredExperiments,
  keptExperiments,
  writeExperiments
} from '@plitzi/sdk-shared/experiments';
import { documentCookies } from '@plitzi/sdk-shared/helpers';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import type { ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

const pageHost = (): string | undefined => (typeof window === 'undefined' ? undefined : window.location.host);

/**
 * The variant each of the space's A/B tests shows this visitor — what `{{ experiments.<name> }}` reads.
 *
 * The server's first: it drew the page with them, and a page hydrated with any other would be thrown away. Then what
 * the visitor kept in their cookie, then a draw for an experiment none of those has — a space rendered with no server
 * in front, or a part of it the server never sent — kept from then on, in this render and in the cookie. In the builder
 * the canvas shows the variant each test's settings name, and nothing is drawn or kept.
 */
const useExperiments = (): ExperimentAssignments => {
  const [[flat, components, serverExperiments]] = useCommonStore([
    'schema.flat',
    'schema.components',
    'experiments.server'
  ]);
  const { builder } = useRenderSettings();
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

  return assignment.assignments;
};

export default useExperiments;
