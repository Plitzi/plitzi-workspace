export type EverySaveProps = {
  domain: string;
  /** It shows every save now. */
  showing: boolean;
  onChoose: () => void;
};

/**
 * A domain that shows every save, as the space's own address does — a setting of the domain, not a way to publish:
 * offered here, said for what it costs (unfinished edits are seen too), and done from the publish view.
 */
const EverySave = ({ domain, showing, onChoose }: EverySaveProps) => (
  <section
    aria-label="Every change, as you save it"
    className="border-ui-line flex flex-col gap-1.5 rounded-lg border p-3"
  >
    <h6 className="text-ui-fg text-sm font-semibold">Every change, as you save it</h6>
    {showing ? (
      <span className="text-ui-fg-subtle text-xs">
        {domain} shows each edit the moment it is saved. Publish your latest changes to show a fixed version instead —
        later edits then wait for your next publish.
      </span>
    ) : (
      <>
        <span className="text-ui-fg-subtle text-xs">
          Like your Plitzi address: visitors see each edit the moment it is saved, unfinished ones too — nothing to
          publish, and no version to go back to. Most sites publish instead.
        </span>
        <button
          type="button"
          className="border-ui-line text-ui-fg hover:bg-ui-hover w-fit rounded-md border px-2.5 py-1 text-xs font-medium"
          onClick={onChoose}
        >
          Show every save on {domain}…
        </button>
      </>
    )}
  </section>
);

export default EverySave;
