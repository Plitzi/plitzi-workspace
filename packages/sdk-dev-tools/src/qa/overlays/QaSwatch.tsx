export type QaSwatchProps = { colour: string };

/** A colour as a chip and its value. */
const QaSwatch = ({ colour }: QaSwatchProps) => (
  <span className="inline-flex items-center gap-1">
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-white/30"
      style={{ backgroundColor: colour.split(' ')[0] }}
    />
    {colour}
  </span>
);

export default QaSwatch;
