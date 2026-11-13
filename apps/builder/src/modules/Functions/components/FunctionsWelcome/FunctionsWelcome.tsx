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
        <h3 className="text-ui-fg text-lg font-semibold">The space’s own server code</h3>
        <p className="text-ui-fg-muted text-sm">
          When no step does what a flow needs, write it in TypeScript — checked as you type, run in a sandbox.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-3">
        {POINTS.map(point => (
          <div key={point.title} className="border-ui-line bg-ui-panel flex flex-col gap-1.5 rounded-lg border p-3">
            <i className={`fa-solid ${point.icon} text-ui-fg-subtle text-xs`} />
            <span className="text-ui-fg text-xs font-semibold">{point.title}</span>
            <span className="text-ui-fg-muted text-xs leading-relaxed">{point.text}</span>
          </div>
        ))}
      </div>
      <Button onClick={onStart}>Start with an example</Button>
      <span className="text-ui-fg-subtle text-[11px]">
        Or work in your own editor: <code>plitzi functions pull</code> edits these same files.
      </span>
    </div>
  </div>
);

export default FunctionsWelcome;
