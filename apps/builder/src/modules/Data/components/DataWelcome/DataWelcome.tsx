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
        <h3 className="text-ui-fg text-lg font-semibold">The space’s own data</h3>
        <p className="text-ui-fg-muted text-sm">
          A catalog, prices, a menu: JSON the pages read whole, kept with the space instead of in a service of its own.
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
        Or work in your own editor: a project&apos;s <code>src/data/</code> goes up with <code>plitzi space push</code>.
      </span>
    </div>
  </div>
);

export default DataWelcome;
