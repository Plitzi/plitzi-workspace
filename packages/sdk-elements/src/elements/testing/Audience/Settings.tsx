import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

type SettingsProps = {
  builderVariant?: number;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** An audience's settings: the variant the canvas shows. Each variant's own settings say who it is for. */
const Settings = ({ builderVariant = 0, onUpdate }: SettingsProps) => {
  // Shown counting from 1, kept from 0: what cannot be read as a place is left as it was.
  const handleShown = useCallback(
    (value: string) => {
      const place = Number(value);
      if (value.trim() !== '' && Number.isInteger(place) && place >= 1) {
        onUpdate?.('builderVariant', place - 1);
      }
    },
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input
        type="number"
        label="Show in the builder: variant"
        size="xs"
        min={1}
        value={String(builderVariant + 1)}
        onChange={handleShown}
      />
      <span className="text-ui-fg-subtle text-xs">
        Each visitor sees the first variant whose rule they match: who it is for is set on each variant. The canvas
        shows the one named here, whoever you are.
      </span>
    </div>
  );
};

export default Settings;
