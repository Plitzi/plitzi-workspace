import Button from '@plitzi/plitzi-ui/Button';
import Card from '@plitzi/plitzi-ui/Card';
import Heading from '@plitzi/plitzi-ui/Heading';
import { useCallback } from 'react';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import RuntimeEnvironments from './components/RuntimeEnvironments';
import RuntimeVariables from './components/RuntimeVariables';

/**
 * The space's runtime: its own server code, run as a process of its own beside the platform — for what functions
 * cannot be (Node and its packages, connections that stay open, an agent's endpoint). Its code is pushed from the
 * project that holds it (`plitzi runtime push`); here is how each environment's is doing, and what it starts with.
 */
const Runtime = () => {
  const { data, isLoading, mutate } = useGraphQL('SpaceRuntime', data => data?.SpaceRuntime);
  const environments = data?.environments ?? [];

  const handleRefresh = useCallback(async () => {
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
            <span className="text-sm text-gray-500 dark:text-zinc-400">
              This space has no runtime. Push one from the project that holds it: <code>plitzi runtime push</code>.
            </span>
          )}
          {environments.length > 0 && <RuntimeEnvironments environments={environments} onChange={handleRefresh} />}
          <RuntimeVariables names={data?.variables ?? []} onChange={handleRefresh} />
        </div>
      </Card.Body>
    </Card>
  );
};

export default Runtime;
