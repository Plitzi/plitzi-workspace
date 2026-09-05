import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import { useCallback, useMemo, useState } from 'react';

import { slugifyElementId } from '@plitzi/sdk-schema/helpers/elementId';

import type { Element } from '@plitzi/sdk-shared';

export type ElementDefinitionSettingsProps = {
  definition: Element['definition'];
  /** The one name this element answers to. Editing it renames the element across the whole document. */
  id: string;
  /** Why this id cannot be used here, or null when it is free. Given the slugified id, never the raw typing. */
  getNameConflict: (id: string) => string | null;
  onUpdate?: (key: string, value: string | boolean | number | object, isDefinition?: boolean) => void;
  onRename: (id: string) => void;
};

const ElementDefinitionSettings = ({
  definition,
  id,
  getNameConflict,
  onUpdate,
  onRename
}: ElementDefinitionSettingsProps) => {
  const [showStyleVariants, setShowStyleVariants] = useStorage('builder-state.elementTools.showStyleVariants', false);
  const [showLabel, setShowLabel] = useStorage('builder-state.elementTools.showLabel', false);
  const [name, setName] = useState(id);
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

  const handleClickLabel = useCallback(() => setShowLabel(state => !state), [setShowLabel]);

  // What a person types is slugified into the id it will become, and it is that id which is checked and committed —
  // so the field accepts prose ("Hero section") and the document still gets a key it can hold.
  const nextId = useMemo(() => slugifyElementId(name), [name]);

  const nameError = useMemo(() => {
    if (!name || nextId === id) {
      return '';
    }

    if (!nextId) {
      return 'A name has to start with a letter';
    }

    return getNameConflict(nextId) ?? '';
  }, [name, nextId, id, getNameConflict]);

  const handleBlurName = useCallback(() => {
    if (nameError || !nextId || nextId === id) {
      setName(id);

      return;
    }

    onRename(nextId);
  }, [nameError, nextId, id, onRename]);

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
        <Input
          className="grow"
          placeholder="hero"
          size="xs"
          value={name}
          error={nameError}
          title="The name this element answers to: what the tree shows, what a binding reads it by, and what an interaction targets. Renaming it repoints everything that names it."
          onChange={setName}
          onBlur={handleBlurName}
        />
        <Button size="xs" intent={showLabel ? 'secondary' : 'primary'} onClick={handleClickLabel} title="Label">
          <Button.Icon icon="fa-solid fa-tag" />
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
      {showLabel && (
        <Input
          size="xs"
          label="Label"
          placeholder="Hero section"
          value={label}
          title="Free display text. Nothing wires by it — that is what the name above is for."
          onChange={handleChangeLabel}
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
