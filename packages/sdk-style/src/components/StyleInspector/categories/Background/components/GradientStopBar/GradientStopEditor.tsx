import ColorPicker from '@plitzi/plitzi-ui/ColorPicker';
import Icon from '@plitzi/plitzi-ui/Icon';
import MetricInput from '@plitzi/plitzi-ui/MetricInput';

import type { GradientStop } from '../../helpers/backgroundParser';

type GradientStopEditorProps = {
  stop: GradientStop;
  showRemove: boolean;
  onColorChange: (color: string) => void;
  onPositionChange: (value: unknown) => void;
  onRemove: () => void;
};

const GradientStopEditor = ({
  stop,
  showRemove,
  onColorChange,
  onPositionChange,
  onRemove
}: GradientStopEditorProps) => (
  <div className="flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 p-1.5 dark:border-zinc-700 dark:bg-zinc-800/50">
    <div className="min-w-0 flex-1">
      <ColorPicker
        size="xs"
        className={{ root: 'w-full min-w-0' }}
        value={stop.color}
        allowVariables
        showAlpha
        onChange={onColorChange}
      />
    </div>
    <MetricInput
      size="xs"
      className="w-20 shrink-0"
      value={stop.position}
      units={[{ label: '%', value: '%' }]}
      allowedWords={[]}
      min={0}
      max={100}
      onChange={onPositionChange}
    />
    {showRemove && (
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded p-0.5 text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
        title="Remove stop"
        onClick={onRemove}
      >
        <Icon icon="fas fa-times" size="xs" />
      </button>
    )}
  </div>
);

export default GradientStopEditor;
