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
  const styleVariant = useMemo(() => get(initialState, 'styleVariant'), [initialState]);

  const styleVariants = useMemo<[string, string][]>(
    () =>
      Object.keys(styleSelectors).flatMap(key => {
        const value = styleVariant?.[key];

        if (Array.isArray(value)) {
          return value.map(v => [key, v] as [string, string]);
        }

        return [[key, value ?? ''] as [string, string]];
      }),
    [styleSelectors, styleVariant]
  );

  const handleClickStyleVariants = useCallback(() => setShowStyleVariants(state => !state), []);

  const handleChangeLabel = useCallback((value: string) => onUpdate?.('label', value, true), [onUpdate]);

  const handleChangeStyleVariant = useCallback(
    (value: [string, string][]) => {
      const valueParsed = value.reduce<Record<string, string | string[]>>((acc, [key, val]) => {
        if (!acc[key]) {
          acc[key] = val;
        } else if (Array.isArray(acc[key])) {
          acc[key] = [...acc[key], val];
        } else {
          acc[key] = [acc[key], val];
        }

        return acc;
      }, {});

      onUpdate?.('initialState', { ...initialState, styleVariant: valueParsed }, true);
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
          allowDuplicateKeys
          keysAllowed={Object.keys(styleSelectors)}
          required={false}
          clearable
          onChange={handleChangeStyleVariant}
        />
      )}
    </div>
  );
};

export default ElementDefinitionSettings;
