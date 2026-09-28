import Button from '@plitzi/plitzi-ui/Button';
import Card from '@plitzi/plitzi-ui/Card';
import Heading from '@plitzi/plitzi-ui/Heading';
import { useCallback, useMemo, useState } from 'react';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import RuntimeCodeNote from './components/RuntimeCodeNote';
import RuntimeEnvironments from './components/RuntimeEnvironments';
import RuntimeVariables from './components/RuntimeVariables';

import type { BuilderQueriesMap } from '@plitzi/sdk-shared';

/** How often the panel asks again while a runtime is on its way somewhere. */
const WATCH_MS = 2000;

/**
 * How long after a change the panel keeps asking even though nothing says `starting` yet: the orchestrator takes a
 * change up on its next round, so the first answer after one is usually still the old state.
 */
const SETTLE_MS = 20_000;

/** Asking again while a runtime starts — or a change may still be on its way to it — and not otherwise. */
const refreshWhile =
  (watchUntil: number) =>
  (latest?: BuilderQueriesMap['SpaceRuntime']): number =>
    latest?.SpaceRuntime.environments.some(environment => environment.status === 'starting') || Date.now() < watchUntil
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

  return (
    <Card className="relative flex grow basis-0" rounded="none">
      <Card.Body grow>
        <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col gap-6 p-4">
          <div className="flex items-center justify-between gap-2">
            <Heading as="h5">Runtime</Heading>
            <Button size="sm" intent="secondary" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
          {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
          {!isLoading && environments.length === 0 && (
            <span className="text-sm text-gray-500 dark:text-zinc-400">This space has no runtime yet.</span>
          )}
          {!isLoading && <RuntimeCodeNote pushed={environments.length > 0} />}
          {environments.length > 0 && <RuntimeEnvironments environments={environments} onChange={handleChange} />}
          <RuntimeVariables names={data?.variables ?? []} onChange={handleChange} />
        </div>
      </Card.Body>
    </Card>
  );
};

export default Runtime;
