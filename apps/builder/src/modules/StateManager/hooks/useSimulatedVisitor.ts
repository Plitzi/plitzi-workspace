import { useMemo } from 'react';

import { languageFrom } from '@plitzi/sdk-shared/audiences';
import { useBuilderStore, useBuilderStoreSync } from '@plitzi/sdk-shared/store';

import type { DisplayMode } from '@plitzi/sdk-shared';
import type { VisitorFacts } from '@plitzi/sdk-shared/audiences';

/**
 * The visitor the canvas shows the page to, for the space's audiences: the device it is sized as, the editor's own
 * language and a first visit — each replaced by what the State Manager's Visitor tab chose. Published as the page's
 * `visitor`, the facts a server would have read off a request, so the canvas's preview draws the variant it matches —
 * and the instant it is shown at (`clock`), when one is chosen.
 */
const useSimulatedVisitor = (displayMode: DisplayMode): VisitorFacts => {
  const [[simulation, simulatedAt]] = useBuilderStore(['visitorSimulation', 'simulatedAt']);
  const visitor = useMemo(
    (): VisitorFacts => ({
      device: simulation?.device ?? displayMode,
      language: simulation?.language ?? languageFrom(typeof navigator === 'undefined' ? '' : navigator.language),
      returning: simulation?.returning ?? false
    }),
    [displayMode, simulation]
  );
  useBuilderStoreSync('visitor', visitor);
  // The instant the preview is shown at, for what shows by the time: the one chosen, kept as it is; the editor's clock
  // until then.
  const clock = useMemo(
    () => (simulatedAt === undefined ? undefined : { at: simulatedAt, simulated: true }),
    [simulatedAt]
  );
  useBuilderStoreSync('clock', clock);

  return visitor;
};

export default useSimulatedVisitor;
