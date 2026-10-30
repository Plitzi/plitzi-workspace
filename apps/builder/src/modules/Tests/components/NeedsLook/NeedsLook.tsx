/** The mark of a test that needs a look — written so it cannot be read as it is — with what is wrong, on hover. */
const NeedsLook = ({ problems }: { problems: readonly string[] }) =>
  problems.length > 0 ? (
    <i
      role="img"
      aria-label={`Needs a look: ${problems.join(' ')}`}
      title={`Needs a look — ${problems.join(' ')}`}
      className="fa-solid fa-circle-exclamation shrink-0 text-sm text-amber-500"
    />
  ) : null;

export default NeedsLook;
