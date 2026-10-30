import Badge from '@plitzi/plitzi-ui/Badge';
import { useState } from 'react';

import ViewPage from '@pmodules/App/components/ViewPage';

import RunStep from './components/RunStep';
import { frameWidthOf, shownStepOf } from '../../helpers';

import type { E2eTest } from '@plitzi/sdk-shared';
import type { TSpaceE2eResult } from '@plitzi/sdk-shared/network';

export type E2eRunViewProps = {
  test: E2eTest;
  result: TSpaceE2eResult;
  onBack: () => void;
};

/**
 * An e2e test's run, replayed: the page in a device frame as it was once a step was played, beside the steps as they
 * went — the one that failed shown first, any other a click away.
 */
const E2eRunView = ({ test, result, onBack }: E2eRunViewProps) => {
  const [shown, setShown] = useState(() => shownStepOf(result.steps));
  const frame = result.steps[shown]?.frame;
  const width = frameWidthOf(test.width ?? 1440);

  return (
    <ViewPage
      onBack={onBack}
      backLabel="Tests"
      title={test.title || test.id}
      description={`${test.page} · ${String(test.width ?? 1440)} px · played on the draft in ${(result.ms / 1000).toFixed(1)} s`}
      actions={
        <Badge intent={result.ok ? 'success' : 'error'} size="xs" solid={false}>
          {result.ok ? 'Passes' : 'Fails'}
        </Badge>
      }
    >
      {result.problem && <p className="text-sm text-red-600 dark:text-red-400">{result.problem}</p>}
      <div className="flex flex-wrap items-start gap-6">
        <div
          className="shrink-0 overflow-hidden rounded-[28px] border-[6px] border-zinc-900 bg-zinc-950 shadow-lg dark:border-zinc-700"
          style={{ width: width + 12 }}
        >
          {frame && <img src={frame} alt={`The page after step ${String(shown + 1)}`} className="block w-full" />}
          {!frame && (
            <div className="flex h-96 items-center justify-center px-6 text-center text-xs text-zinc-400">
              No picture of this step: it was not played.
            </div>
          )}
        </div>
        <div className="flex min-w-72 grow basis-0 flex-col gap-2">
          {result.steps.map((step, index) => (
            <RunStep
              key={`${String(index)}-${step.said}`}
              index={index}
              step={step}
              shown={index === shown}
              onShow={setShown}
            />
          ))}
        </div>
      </div>
    </ViewPage>
  );
};

export default E2eRunView;
