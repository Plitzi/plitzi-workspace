import Button from '@plitzi/plitzi-ui/Button';

import { FUNCTION_ROUTES_PREFIX } from '@plitzi/sdk-shared/actions';

export type FunctionsWelcomeProps = { onStart: () => void };

const POINTS = [
  {
    icon: 'fa-bolt',
    title: 'Tasks',
    text: 'Steps any action can run — parse a feed, call an API with its own shape, compute something.'
  },
  {
    icon: 'fa-route',
    title: 'Routes',
    text: `HTTP endpoints of the space’s own, answered under ${FUNCTION_ROUTES_PREFIX}.`
  },
  {
    icon: 'fa-shield-halved',
    title: 'Sandboxed',
    text: 'Run by Plitzi with the CPU each task asks for, reaching only the hosts you allow.'
  }
];

/** A space with no functions yet: what they are for, and one written already to change rather than a blank file. */
const FunctionsWelcome = ({ onStart }: FunctionsWelcomeProps) => (
  <div className="flex grow items-center justify-center overflow-auto p-6">
    <div className="flex max-w-xl flex-col items-center gap-6 text-center">
      <span className="bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex size-12 items-center justify-center rounded-xl">
        <i className="fa-solid fa-code" />
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-50">The space’s own server code</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          When no step does what a flow needs, write it in TypeScript — checked as you type, run in a sandbox.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-3">
        {POINTS.map(point => (
          <div
            key={point.title}
            className="flex flex-col gap-1.5 rounded-lg border border-gray-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <i className={`fa-solid ${point.icon} text-xs text-gray-500 dark:text-zinc-400`} />
            <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{point.title}</span>
            <span className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400">{point.text}</span>
          </div>
        ))}
      </div>
      <Button onClick={onStart}>Start with an example</Button>
      <span className="text-[11px] text-gray-500 dark:text-zinc-400">
        Or work in your own editor: <code>plitzi functions pull</code> edits these same files.
      </span>
    </div>
  </div>
);

export default FunctionsWelcome;
