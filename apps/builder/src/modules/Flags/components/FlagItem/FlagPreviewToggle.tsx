import FlagPreviewOption from './FlagPreviewOption';

import type { FlagPreviewOptionValue } from './FlagPreviewOption';

export type FlagPreviewToggleProps = {
  name: string;
  /** What the canvas is forced to, if anything. */
  forced?: boolean;
  onForce: (name: string, value: boolean | undefined) => void;
};

const OPTIONS: FlagPreviewOptionValue[] = [
  { label: 'Auto', value: undefined, title: 'Show the canvas as the flag resolves on its own' },
  { label: 'On', value: true, title: 'Show the canvas with this flag on' },
  { label: 'Off', value: false, title: 'Show the canvas with this flag off' }
];

/** Forces a flag in the canvas only — what an author looks at, never what is saved or published. */
const FlagPreviewToggle = ({ name, forced, onForce }: FlagPreviewToggleProps) => (
  <div className="flex overflow-hidden rounded border border-gray-300 dark:border-zinc-700">
    {OPTIONS.map(option => (
      <FlagPreviewOption
        key={option.label}
        name={name}
        option={option}
        active={forced === option.value}
        onForce={onForce}
      />
    ))}
  </div>
);

export default FlagPreviewToggle;
