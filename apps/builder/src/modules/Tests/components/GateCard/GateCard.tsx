export type GateCardProps = {
  ready: number;
  total: number;
  /** The journeys that cannot be read as written, by id: said calmly, the first one shown on asking. */
  flowsNeedLook: readonly string[];
  /** Element checks written so they cannot be read, or that do not hold. */
  checksNeedLook: number;
  onChecks: () => void;
  onShowFlow: (id: string) => void;
};

/**
 * The rule the tests are kept for, said where they are: a snapshot and a publish wait for every flow and every element
 * check — and how many stand ready now.
 */
const GateCard = ({ ready, total, flowsNeedLook, checksNeedLook, onChecks, onShowFlow }: GateCardProps) => (
  <section
    aria-label="Before a snapshot or a publish"
    className="border-ui-line-strong flex shrink-0 flex-col gap-1 rounded-lg border px-3 py-2.5"
  >
    <span className="text-ui-fg-subtle text-[11px] font-semibold tracking-wider uppercase">
      Before a snapshot or a publish
    </span>
    <span className="text-ui-fg text-sm font-medium">Every journey and every element check must pass.</span>
    <div className="flex items-baseline gap-2">
      <span className="text-ui-fg text-2xl leading-none font-semibold tabular-nums">{ready}</span>
      <span className="text-ui-fg-subtle text-xs">of {total} ready, as last played</span>
      <button
        type="button"
        className="text-primary-text ml-auto cursor-pointer text-xs font-medium hover:underline"
        onClick={onChecks}
      >
        Element checks
      </button>
    </div>
    {flowsNeedLook.length > 0 && (
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1.5 text-left text-xs text-amber-700 hover:underline dark:text-amber-300"
        onClick={() => onShowFlow(flowsNeedLook[0])}
      >
        <i className="fa-solid fa-circle-exclamation" />
        {flowsNeedLook.length === 1
          ? '1 journey needs a look'
          : `${String(flowsNeedLook.length)} journeys need a look`}{' '}
        — show it
      </button>
    )}
    {checksNeedLook > 0 && (
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1.5 text-left text-xs text-amber-700 hover:underline dark:text-amber-300"
        onClick={onChecks}
      >
        <i className="fa-solid fa-circle-exclamation" />
        {checksNeedLook === 1
          ? '1 element check needs a look'
          : `${String(checksNeedLook)} element checks need a look`}{' '}
        — see it
      </button>
    )}
  </section>
);

export default GateCard;
