import SegmentedButton from './components/SegmentedButton';

export type SegmentedOption = { id: string; label: string };

export type SegmentedProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

const Segmented = ({ options, value, onChange, className }: SegmentedProps) => (
  <div
    role="tablist"
    className={`inline-flex flex-wrap items-center justify-center gap-1 rounded-xl border border-ink-700 bg-ink-900/60 p-1.5 ${className ?? ''}`}
  >
    {options.map(option => (
      <SegmentedButton
        key={option.id}
        id={option.id}
        label={option.label}
        isActive={option.id === value}
        onSelect={onChange}
      />
    ))}
  </div>
);

export default Segmented;
