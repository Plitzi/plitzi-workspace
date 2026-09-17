import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo, useState } from 'react';

import { slugifyElementId } from '@plitzi/sdk-schema/helpers/elementId';

import type { Element, ElementLoadStrategy } from '@plitzi/sdk-shared';

export type ElementDefinitionSettingsProps = {
  definition: Element['definition'];
  /** Whether the element's TYPE holds children — an instance's own `items` is not a reliable answer. */
  canHoldItems?: boolean;
  /** What the element's type declares, which is what an instance with no strategy of its own follows. */
  declaredLoadStrategy?: ElementLoadStrategy;
  /** The one name this element answers to. Editing it renames the element across the whole document. */
  id: string;
  /** Why this id cannot be used here, or null when it is free. Given the slugified id, never the raw typing. */
  getNameConflict: (id: string) => string | null;
  /** `undefined` removes the key, handing the decision back to the element's type. */
  onUpdate?: (key: string, value: string | boolean | number | object | undefined, isDefinition?: boolean) => void;
  onRename: (id: string) => void;
};

const LOAD_STRATEGIES: Record<ElementLoadStrategy, { label: string; help: string }> = {
  eager: { label: 'Eager', help: 'Its content is always mounted, shown or not.' },
  lazy: {
    label: 'Lazy',
    help: 'Its content mounts the first time it is shown and then stays — nothing is built for a modal nobody opens, and what was typed into it survives closing it.'
  },
  visible: {
    label: 'Only while visible',
    help: 'Its content is mounted only while it is shown, and rebuilt on every opening — for content that is expensive to keep, like a live map or a video.'
  }
};

const isLoadStrategy = (value: string): value is ElementLoadStrategy => Object.hasOwn(LOAD_STRATEGIES, value);

const ElementDefinitionSettings = ({
  definition,
  canHoldItems = false,
  declaredLoadStrategy = 'eager',
  id,
  getNameConflict,
  onUpdate,
  onRename
}: ElementDefinitionSettingsProps) => {
  const [showStyleVariants, setShowStyleVariants] = useStorage('builder-state.elementTools.showStyleVariants', false);
  const [showLabel, setShowLabel] = useStorage('builder-state.elementTools.showLabel', false);
  const [name, setName] = useState(id);
  const { label, initialState, styleSelectors, loadStrategy } = definition;
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

  // Only for what holds content, and never for a page: the strategy decides when an element's ITEMS mount relative to
  // its visibility, and a page is not hidden the way a modal is.
  const showLoadStrategy = canHoldItems && definition.type !== 'page';

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

  const handleChangeLoadStrategy = useCallback(
    (value: string) => onUpdate?.('loadStrategy', isLoadStrategy(value) ? value : undefined, true),
    [onUpdate]
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
      {showLoadStrategy && (
        <div className="flex flex-col gap-1">
          <Select size="xs" label="Load content" value={loadStrategy ?? ''} onChange={handleChangeLoadStrategy}>
            <option value="">Default — {LOAD_STRATEGIES[declaredLoadStrategy].label}</option>
            {Object.entries(LOAD_STRATEGIES).map(([value, strategy]) => (
              <option key={value} value={value}>
                {strategy.label}
              </option>
            ))}
          </Select>
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            {LOAD_STRATEGIES[loadStrategy ?? declaredLoadStrategy].help} Everything stays mounted while editing.
          </span>
        </div>
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
