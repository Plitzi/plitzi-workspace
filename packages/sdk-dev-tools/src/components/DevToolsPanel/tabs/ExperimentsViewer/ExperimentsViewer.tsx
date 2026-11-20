import { useCallback, useMemo } from 'react';

import { declaredExperiments, withForcedExperiment, writeForcedExperiments } from '@plitzi/sdk-shared/experiments';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import ExperimentsListItem from './ExperimentsListItem';

import type { ExperimentAssignments, ExperimentVariant } from '@plitzi/sdk-shared/experiments';

const NONE: ExperimentAssignments = {};

/**
 * The space's A/B tests as this page drew them — each experiment's variant for this visitor — with a way to force any
 * variant for this browser.
 *
 * Forcing is a tester's: it shows the variant on the page that is open and keeps it in a session cookie of its own, so
 * the next page is drawn with it on the server too — and never touches the variant the visitor keeps, so a tester's
 * visit is not measured as one it was not drawn. Offered only here, and the dev tools only where debugging is
 * authorized: the same rule the server applies before honouring the cookie.
 */
const ExperimentsViewer = () => {
  const [[flat, components, assigned = NONE]] = useCommonStore([
    'schema.flat',
    'schema.components',
    'experiments.assigned'
  ]);
  const [forced = NONE, setForced] = useCommonStore('experiments.qa');
  const declared = useMemo(() => declaredExperiments({ flat, components }), [flat, components]);
  const names = Object.keys(declared);

  const handleForce = useCallback(
    (name: string, variant: ExperimentVariant | undefined) => {
      const next = withForcedExperiment(forced, name, variant);
      setForced(next);
      writeForcedExperiments(next);
    },
    [forced, setForced]
  );

  const handleClearAll = useCallback(() => {
    setForced({});
    writeForcedExperiments({});
  }, [setForced]);

  if (names.length === 0) {
    return <div className="text-ui-fg-subtle py-4 text-center text-xs italic">This space runs no A/B tests</div>;
  }

  return (
    <div className="flex w-full flex-col gap-1.5 overflow-y-auto p-3">
      <div className="text-ui-fg-subtle flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider uppercase">
        <span className="flex items-center gap-2">
          <i className="fa-solid fa-flask" />
          A/B tests
        </span>
        {Object.keys(forced).length > 0 && (
          <button
            type="button"
            className="hover:bg-ui-hover rounded px-1.5 py-0.5 font-medium normal-case"
            onClick={handleClearAll}
          >
            Stop forcing all
          </button>
        )}
      </div>
      <div className="border-ui-line w-full overflow-hidden rounded border">
        {names.map(name => (
          <ExperimentsListItem
            key={name}
            name={name}
            weights={declared[name].weights}
            shown={assigned[name]}
            forced={forced[name]}
            onForce={handleForce}
          />
        ))}
      </div>
    </div>
  );
};

export default ExperimentsViewer;
