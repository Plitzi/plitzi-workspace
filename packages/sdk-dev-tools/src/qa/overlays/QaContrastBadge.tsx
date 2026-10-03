import clsx from 'clsx';

export type QaContrastBadgeProps = { ratio: number; needs: number };

/** The text's contrast against what is behind it, and whether it passes AA for its size. */
const QaContrastBadge = ({ ratio, needs }: QaContrastBadgeProps) => (
  <span
    className={clsx('rounded px-1 font-semibold', {
      'bg-emerald-500/20 text-emerald-300': ratio >= needs,
      'bg-rose-500/25 text-rose-300': ratio < needs
    })}
    title={`AA needs ${String(needs)}:1 for this size`}
  >
    {ratio.toFixed(2)}:1
  </span>
);

export default QaContrastBadge;
