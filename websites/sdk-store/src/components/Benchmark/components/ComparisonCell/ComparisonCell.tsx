export type ComparisonCellProps = {
  value: string;
  highlight?: boolean;
};

const ComparisonCell = ({ value, highlight }: ComparisonCellProps) => {
  if (value === 'yes') {
    return <span className={highlight ? 'text-brand-400' : 'text-emerald-400'}>✓</span>;
  }

  if (value === 'no') {
    return <span className="text-zinc-700">—</span>;
  }

  return <span className="text-[11px] text-zinc-500">{value}</span>;
};

export default ComparisonCell;
