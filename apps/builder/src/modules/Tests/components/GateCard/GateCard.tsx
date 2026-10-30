export type GateCardProps = {
  ready: number;
  total: number;
  onChecks: () => void;
};

/**
 * The rule the tests are kept for, said where they are: a snapshot and a publish wait for every flow and every element
 * check — and how many stand ready now.
 */
const GateCard = ({ ready, total, onChecks }: GateCardProps) => (
  <section
    aria-label="Before a snapshot or a publish"
    className="flex shrink-0 flex-col gap-1 rounded-lg border border-gray-300 px-3 py-2.5 dark:border-zinc-700"
  >
    <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
      Before a snapshot or a publish
    </span>
    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
      Every flow and every element check must pass.
    </span>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl leading-none font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">{ready}</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">of {total} ready, as last played</span>
      <button
        type="button"
        className="text-primary-text ml-auto cursor-pointer text-xs font-medium hover:underline"
        onClick={onChecks}
      >
        Element checks
      </button>
    </div>
  </section>
);

export default GateCard;
