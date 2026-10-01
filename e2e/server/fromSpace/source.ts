import type { PluginDeclarationData } from '@plitzi/sdk-authoring';

/**
 * The code a space called Tally is made of, as Plitzi keeps it: the source its plugin and its runtime were built from,
 * and its functions. Text, as a snapshot holds it — this is what `plitzi create --from` is handed, not code this suite
 * runs, which is why it is written as strings rather than checked here.
 *
 * Small on purpose, and each part there to be found again in the project the CLI writes: a plugin rendered on the
 * server, a runtime answering a route of its own, a file the two of them import (the closure a snapshot is about), and
 * a function an action runs.
 */

export const TALLY_TYPE = 'tally';

/** What the space is authored with — and what the plugin's own `declaration.ts` below says, word for word. */
export const tallyDeclaration: PluginDeclarationData = {
  type: TALLY_TYPE,
  triggers: {},
  callbacks: {},
  content: {
    attributes: { label: 'Tally' },
    definition: { label: 'Tally', items: [], styleSelectors: { base: '' } }
  }
};

/** The shared file: imported by the plugin and by the runtime both. */
const greeting = `export const greeting = (who: string): string => \`Hello from the \${who}\`;
`;

const declaration = `const declaration = ${JSON.stringify(tallyDeclaration, null, 2)};

export default declaration;
`;

const component = `import { RootElement } from '@plitzi/plitzi-sdk';

import { greeting } from '../../shared/greeting.ts';

export type TallyProps = { label?: string; className?: string };

const Tally = ({ label = 'Tally', className }: TallyProps) => (
  <RootElement className={className}>
    <strong>{label}</strong> <span>{greeting('plugin')}</span>
  </RootElement>
);

export default Tally;
`;

const plugin = `import declaration from './declaration.ts';
import Tally from './Tally.tsx';

export default Object.assign(Tally, declaration);
`;

const runtime = `import { defineRuntime } from '@plitzi/sdk-server/runtime';

import { greeting } from './shared/greeting.ts';

export default defineRuntime({
  start: () => ({ endpoints: { '/hello': () => Response.json({ greeting: greeting('runtime') }) } })
});
`;

/** The source tree the space's snapshots hold, merged, by path in the project. */
export const SOURCE_FILES: Record<string, string> = {
  'shared/greeting.ts': greeting,
  'plugins/Tally/declaration.ts': declaration,
  'plugins/Tally/Tally.tsx': component,
  'plugins/Tally/index.ts': plugin,
  'runtime.ts': runtime
};

/** The space's functions: one task, counting in the server's own `kv`. */
export const FUNCTION_FILES: Record<string, string> = {
  'index.ts': `import { defineFunctions } from '@plitzi/sdk-server/functions';

export default defineFunctions({
  tasks: [
    {
      namespace: 'tally',
      action: 'add',
      title: 'Add One',
      description: 'One more, and how many there are.',
      params: {},
      run: async (_params, ctx) => ({
        count: (await ctx.kv.change<number>('count', current => (typeof current === 'number' ? current : 0) + 1)) ?? 0
      })
    }
  ]
});
`
};
