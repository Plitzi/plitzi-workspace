import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import get from 'lodash-es/get';
import { useCallback, useMemo } from 'react';

import type { Element } from '@plitzi/sdk-shared';

export type ElementDefinitionSettingsProps = {
  definition: Element['definition'];
  onUpdate?: (key: string, value: string | boolean | number | object, isDefinition?: boolean) => void;
};

const ElementDefinitionSettings = ({ definition, onUpdate }: ElementDefinitionSettingsProps) => {
  const { label, initialState } = definition;
  const visibility = useMemo(() => get(initialState, 'visibility', true), [initialState]);

  const handleChangeLabel = useCallback((value: string) => onUpdate?.('label', value, true), [onUpdate]);

  const handleClickVisibility = useCallback(
    () => onUpdate?.('initialState', { ...initialState, visibility: !visibility }, true),
    [onUpdate, initialState, visibility]
  );

  return (
    <div className="flex gap-4 py-2">
      <Input className="grow" size="sm" value={label} onChange={handleChangeLabel} />
      <Button size="sm" className="rounded-sm" onClick={handleClickVisibility}>
        {visibility && <i className="fa-solid fa-eye" />}
        {!visibility && <i className="fa-solid fa-eye-slash" />}
      </Button>
    </div>
  );
};

export default ElementDefinitionSettings;
