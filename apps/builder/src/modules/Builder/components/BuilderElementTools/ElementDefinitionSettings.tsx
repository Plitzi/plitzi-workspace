import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import { useCallback, useMemo, useState } from 'react';

import type { Element } from '@plitzi/sdk-shared';

export type ElementDefinitionSettingsProps = {
  definition: Element['definition'];
  onUpdate?: (key: string, value: string | boolean | number | object, isDefinition?: boolean) => void;
};

const ElementDefinitionSettings = ({ definition, onUpdate }: ElementDefinitionSettingsProps) => {
  const [showStyleVariants, setShowStyleVariants] = useState(false);
  const { label, initialState, styleSelectors } = definition;
  const visibility = useMemo(() => get(initialState, 'visibility', true), [initialState]);
  const styleVariant = useMemo(
    () => get(initialState, 'styleVariant', {} as Partial<Record<string, string>>),
    [initialState]
  );

  const styleVariants = useMemo<[string, string][]>(
    () => Object.keys(styleSelectors).map(key => [key, styleVariant[key] ?? '']),
    [styleSelectors, styleVariant]
  );

  const handleClickStyleVariants = useCallback(() => setShowStyleVariants(state => !state), []);

  const handleChangeLabel = useCallback((value: string) => onUpdate?.('label', value, true), [onUpdate]);

  const handleChangeStyleVariant = useCallback(
    (value: [string, string][]) => {
      onUpdate?.('initialState', { ...initialState, styleVariant: Object.fromEntries(value) }, true);
    },
    [initialState, onUpdate]
  );

  const handleClickVisibility = useCallback(
    () => onUpdate?.('initialState', { ...initialState, visibility: !visibility }, true),
    [onUpdate, initialState, visibility]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input className="grow" size="xs" value={label} onChange={handleChangeLabel} />
        <Button size="xs" onClick={handleClickStyleVariants} title="Style Manager">
          <Button.Icon icon={showStyleVariants ? 'fas fa-xmark' : 'fas fa-swatchbook'} />
        </Button>
        <Button size="xs" onClick={handleClickVisibility}>
          <Button.Icon icon={visibility ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'} />
        </Button>
      </div>
      {showStyleVariants && (
        <KVInput
          size="xs"
          label="Style Variants"
          value={styleVariants}
          allowRemove={false}
          allowAppend={false}
          allowKeyEdit={false}
          required={false}
          clearable
          onChange={handleChangeStyleVariant}
        />
      )}
    </div>
  );
};

export default ElementDefinitionSettings;
