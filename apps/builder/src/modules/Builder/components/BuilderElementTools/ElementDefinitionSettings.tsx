import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import { useCallback, useMemo, useState } from 'react';

import type { Element } from '@plitzi/sdk-shared';
import type { FocusEvent } from 'react';

export type ElementDefinitionSettingsProps = {
  definition: Element['definition'];
  idRef?: string | null;
  getIdRefConflict: (idRef: string) => string | null;
  onUpdate?: (key: string, value: string | boolean | number | object, isDefinition?: boolean) => void;
  onUpdateRef: (value: string) => void;
};

const ElementDefinitionSettings = ({
  definition,
  idRef,
  getIdRefConflict,
  onUpdate,
  onUpdateRef
}: ElementDefinitionSettingsProps) => {
  const [showStyleVariants, setShowStyleVariants] = useStorage('builder-state.elementTools.showStyleVariants', false);
  const [showIdRef, setShowIdRef] = useStorage('builder-state.elementTools.showIdRef', false);
  const currentIdRef = idRef ?? '';
  const [idRefValue, setIdRefValue] = useState(currentIdRef);
  const { label, initialState, styleSelectors } = definition;
  const visibility = useMemo(() => get(initialState, 'visibility', true), [initialState]);
  const styleVariant = useMemo(() => get(initialState, 'styleVariant'), [initialState]);
  const keysAllowed = useMemo(
    () =>
      Object.entries(styleSelectors).flatMap(([styleSelector, selectors]) => {
        const selectorsArr = selectors ? [definition.type, ...selectors.split(' ')] : [definition.type];

        return selectorsArr.map(selector => ({
          value: `${selector}.${styleSelector}`,
          label: `${selector} (${styleSelector})`
        }));
      }),
    [definition.type, styleSelectors]
  );

  const handleClickStyleVariants = useCallback(() => setShowStyleVariants(state => !state), [setShowStyleVariants]);

  const handleClickIdRef = useCallback(() => setShowIdRef(state => !state), [setShowIdRef]);

  const idRefError = useMemo(
    () => (!idRefValue || idRefValue === currentIdRef ? '' : (getIdRefConflict(idRefValue) ?? '')),
    [idRefValue, currentIdRef, getIdRefConflict]
  );

  const handleBlurIdRef = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (idRefError || next === currentIdRef) {
        setIdRefValue(currentIdRef);

        return;
      }

      onUpdateRef(next);
    },
    [idRefError, currentIdRef, onUpdateRef]
  );

  const handleChangeLabel = useCallback((value: string) => onUpdate?.('label', value, true), [onUpdate]);

  const handleChangeStyleVariant = useCallback(
    (_value: [string, string][], valueObj: object) => {
      onUpdate?.('initialState', { ...initialState, styleVariant: valueObj }, true);
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
        <Input className="grow" placeholder="Name" size="xs" value={label} onChange={handleChangeLabel} />
        <Button size="xs" intent={showIdRef ? 'secondary' : 'primary'} onClick={handleClickIdRef} title="Reference">
          <Button.Icon icon="fa-solid fa-link" />
        </Button>
        <Button
          size="xs"
          intent={showStyleVariants ? 'secondary' : 'primary'}
          onClick={handleClickStyleVariants}
          title="Style Manager"
        >
          <Button.Icon icon="fas fa-swatchbook" />
        </Button>
        <Button size="xs" onClick={handleClickVisibility} title="Visibility">
          <Button.Icon icon={visibility ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'} />
        </Button>
      </div>
      {showIdRef && (
        <Input
          size="xs"
          label="Reference"
          placeholder="products-api"
          value={idRefValue}
          error={idRefError}
          title="The name this element publishes its data source under. Without one, nothing can bind to it."
          onChange={setIdRefValue}
          onBlur={handleBlurIdRef}
        />
      )}
      {showStyleVariants && (
        <KVInput
          size="xs"
          label="Style Variants"
          value={styleVariant}
          allowDuplicateKeys
          keysAllowed={keysAllowed}
          required={false}
          clearable
          onChange={handleChangeStyleVariant}
        />
      )}
    </div>
  );
};

export default ElementDefinitionSettings;
