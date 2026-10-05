import Button from '@plitzi/plitzi-ui/Button';

export type DataWelcomeProps = { onStart: () => void };

const POINTS = [
  {
    icon: 'fa-server',
    title: 'Read on the server',
    text: 'A provider with a server runtime and the query /data/products.json — the page arrives with it.'
  },
  {
    icon: 'fa-eye-slash',
    title: 'Never served',
    text: 'Nobody asks for the file itself; a page carries what it reads, so keep private fields in an action.'
  },
  {
    icon: 'fa-clock-rotate-left',
    title: 'Published with the space',
    text: 'The live site reads what the space was last published with; the builder, this draft.'
  }
];

/** A space with no data yet: what it is for, and a file written already to change rather than a blank one. */
const DataWelcome = ({ onStart }: DataWelcomeProps) => (
  <div className="flex grow items-center justify-center overflow-auto p-6">
    <div className="flex max-w-xl flex-col items-center gap-6 text-center">
      <span className="bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex size-12 items-center justify-center rounded-xl">
        <i className="fa-solid fa-database" />
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-50">The space’s own data</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          A catalog, prices, a menu: JSON the pages read whole, kept with the space instead of in a service of its own.
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
        Or work in your own editor: a project&apos;s <code>src/data/</code> goes up with <code>plitzi push</code>.
      </span>
    </div>
  </div>
);

export default DataWelcome;
