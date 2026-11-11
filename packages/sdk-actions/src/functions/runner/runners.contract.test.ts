import { afterAll, beforeAll } from 'vitest';

import { createRuntimeRunner } from '@plitzi/sdk-runtime/host';
import { createIsolateRunner, startFunctionsRunnerService } from '@plitzi/sdk-runtime/runner';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { createRemoteRunner } from './remote';
import { bundleOfCode, describeFunctionRunner } from './tests/runnerContract';

import type { FunctionsRunnerService } from '@plitzi/sdk-runtime/runner';
import type { FunctionsDefinition, FunctionRunner } from '@plitzi/sdk-shared/functions';

/** Every runner Plitzi ships, held to one contract (`tests/runnerContract.ts`). */

const SECRET = 'contract-secret-of-thirty-two-characters';

const isolate = createIsolateRunner();
describeFunctionRunner(
  'the sandbox (createIsolateRunner)',
  code => Promise.resolve({ runner: isolate, bundle: bundleOfCode(code), close: () => Promise.resolve() }),
  {
    limited: true
  }
);

let service: FunctionsRunnerService | undefined;
let remote: FunctionRunner | undefined;
beforeAll(async () => {
  service = await startFunctionsRunnerService({ secret: SECRET, port: 0, host: '127.0.0.1' });
  remote = createRemoteRunner({ url: `ws://127.0.0.1:${String(service.address().port)}`, secret: SECRET });
});
afterAll(async () => {
  await isolate.close?.();
  await service?.close();
});

describeFunctionRunner(
  'the runner service, through its socket (createRemoteRunner)',
  code => {
    if (!remote) {
      throw new Error('The runner service did not start');
    }

    return Promise.resolve({ runner: remote, bundle: bundleOfCode(code), close: () => Promise.resolve() });
  },
  { limited: true }
);

/** A runtime is started with its code: the module's default export, loaded in this process. */
const definitionOf = async (code: string): Promise<FunctionsDefinition> => {
  const loaded: unknown = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  const definition: unknown = isRecord(loaded) ? loaded.default : undefined;
  if (!isRecord(definition)) {
    throw new Error('The probe module exports no definition');
  }

  return definition;
};

describeFunctionRunner(
  'a runtime’s own process (createRuntimeRunner)',
  async code => ({
    runner: createRuntimeRunner(await definitionOf(code)),
    bundle: bundleOfCode(code),
    close: () => Promise.resolve()
  }),
  { limited: false }
);
