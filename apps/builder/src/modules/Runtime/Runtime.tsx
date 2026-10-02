import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useMemo, useState } from 'react';

import EmptyState from '@pmodules/App/components/EmptyState';
import ViewPage from '@pmodules/App/components/ViewPage';
import ViewSection from '@pmodules/App/components/ViewSection';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import RuntimeCodeNote from './components/RuntimeCodeNote';
import RuntimeEnvironments from './components/RuntimeEnvironments';
import RuntimeVariables from './components/RuntimeVariables';

import type { BuilderQueriesMap } from '@plitzi/sdk-shared';

/** How often the panel asks again while a runtime is on its way somewhere. */
const WATCH_MS = 2000;

const DESCRIPTION =
  'This space’s own server code, run beside it — for what its functions cannot be: a connection kept open, memory that outlives a request, Node and its packages.';

/** What a runtime is only on its way through: while one is in either, the panel keeps asking. */
const PASSING = new Set<string>(['starting', 'stopping']);

/**
 * How long after a change the panel keeps asking even though nothing says `starting` yet: the orchestrator takes a
 * change up on its next round, so the first answer after one is usually still the old state.
 */
const SETTLE_MS = 20_000;

/** Asking again while a runtime starts or stops — or a change may still be on its way to it — and not otherwise. */
const refreshWhile =
  (watchUntil: number) =>
  (latest?: BuilderQueriesMap['SpaceRuntime']): number =>
    latest?.SpaceRuntime.environments.some(environment => PASSING.has(environment.status)) || Date.now() < watchUntil
      ? WATCH_MS
      : 0;

/**
 * The space's runtime: its own server code, run as a process of its own beside the platform — for what functions
 * cannot be (Node and its packages, connections that stay open, an agent's endpoint). Its code is pushed from the
 * project that holds it (`plitzi runtime push`), which the panel says in so many words; here is how each environment's
 * is doing, and what it starts with.
 */
const Runtime = () => {
  const [watchUntil, setWatchUntil] = useState(0);
  const config = useMemo(() => ({ refreshInterval: refreshWhile(watchUntil) }), [watchUntil]);
  const { data, isLoading, mutate } = useGraphQL('SpaceRuntime', data => data?.SpaceRuntime, undefined, config);
  const environments = data?.environments ?? [];

  const handleRefresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // A variable set or removed, a runtime restarted: the runtime is on its way to another state — watched until there.
  const handleChange = useCallback(async () => {
    setWatchUntil(Date.now() + SETTLE_MS);
    await mutate();
  }, [mutate]);

  const idleMinutes = data?.idleMinutes ?? 0;

  return (
    <ViewPage
      description={environments.length > 0 ? DESCRIPTION : undefined}
      actions={
        <Button size="sm" intent="secondary" onClick={handleRefresh} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-rotate" />
          Refresh
        </Button>
      }
    >
      {isLoading && <span className="text-sm text-gray-500 dark:text-zinc-400">Loading…</span>}
      {!isLoading && environments.length === 0 && (
        <EmptyState icon="fa-solid fa-server" title="No runtime yet" description={DESCRIPTION} />
      )}
      {environments.length > 0 && (
        <RuntimeEnvironments
          environments={environments}
          sizes={data?.sizes ?? []}
          idleMinutes={idleMinutes}
          onChange={handleChange}
        />
      )}
      {!isLoading && (
        <ViewSection title={environments.length > 0 ? 'Pushing new code' : 'How to push one'}>
          <RuntimeCodeNote pushed={environments.length > 0} idleMinutes={idleMinutes} />
        </ViewSection>
      )}
      <RuntimeVariables names={data?.variables ?? []} onChange={handleChange} />
    </ViewPage>
  );
};

export default Runtime;
