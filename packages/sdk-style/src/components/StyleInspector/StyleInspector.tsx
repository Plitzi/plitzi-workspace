import { get, set, pick } from '@plitzi/plitzi-ui/helpers';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { clsx } from 'clsx';
import { produce } from 'immer';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import { useBuilderStore, useBuilderStoreSync } from '@plitzi/sdk-shared/store';

import Selector from '../Selector';
import AncestorRules from './components/AncestorRules';
import {
  ancestorClasses,
  ancestorConditions,
  ancestorOptions,
  ancestorRemovals,
  STYLE_STATE_OPTIONS,
  unusedAncestors
} from './helpers';
import Inspector from './Inspector';

import type { AncestorCondition } from './helpers';
import type { SelectorValue } from '../Selector';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { DisplayMode, Element, StyleItem, TagType } from '@plitzi/sdk-shared';
import type { StyleState } from '@plitzi/sdk-shared';

export type StyleInspectorProps = {
  displayMode: DisplayMode;
  selectors?: Record<string, StyleItem>;
  value?: string;
  element?: Element;
  componentType?: string;
  mode?: 'element' | 'manager';
  styleSelectors?: Record<string, string>;
  styleSelectorsAvailables?: string[];
  componentSubTypesAvailables?: string[];
  allowStyleSelector?: boolean;
  allowStyleState?: boolean;
  allowStyleVariant?: boolean;
  onChange?: (selector?: string) => void;
  onVariantChange?: (variant?: string) => void; // @todo: pending to implement
  onStateChange?: (state: StyleState) => void; // @todo: pending to implement
  onRemoveVariant?: (variant: string) => void; // @todo: pending to implement
};

const StyleInspector = ({
  displayMode,
  selectors,
  value,
  element,
  mode = 'element',
  componentType,
  styleSelectors,
  styleSelectorsAvailables,
  componentSubTypesAvailables,
  allowStyleSelector = true,
  allowStyleState = true,
  allowStyleVariant = true,
  onChange,
  onRemoveVariant
}: StyleInspectorProps) => {
  const [componentSubType, setComponentSubType] = useState<string | undefined>(undefined);
  const [styleSelector, setStyleSelector] = useState('base');
  const [styleVariant, setStyleVariant] = useState<string | undefined>(undefined);
  const [styleState, setStyleState] = useState<StyleState | undefined>(undefined);
  useBuilderStoreSync('styleSelector', styleSelector, { enabled: mode === 'element' });
  useBuilderStoreSync('styleVariant', styleVariant, { enabled: mode === 'element' });
  const [styleAncestor, setStyleAncestor] = useState<string | undefined>(undefined);
  useBuilderStoreSync('styleState', styleState, { enabled: mode === 'element' });
  useBuilderStoreSync('styleAncestor', styleAncestor, { enabled: mode === 'element' });
  const [[flat, platform]] = useBuilderStore(['schema.flat', 'style.platform']);
  const { builderHandler } = use(BuilderContext);
  const selectorName = useMemo(() => get(styleSelectors, styleSelector, ''), [styleSelectors, styleSelector]);
  const selectorsFiltered = useMemo(
    () =>
      Object.values(
        pick(selectors ?? {}, element ? [element.definition.type, ...selectorName.split(' ')] : selectorName.split(' '))
      ),
    [selectors, element, selectorName]
  );
  const selector = useMemo<StyleItem | undefined>(
    () => (value ? get(selectors, value) : undefined),
    [selectors, value]
  );
  const configuredAncestors = selector?.attributes[styleSelector]?.ancestors;
  // In the Style Manager there is no element to look around, so any class of the space can be the ancestor
  const ancestorCandidates = useMemo(
    () =>
      mode === 'element'
        ? ancestorClasses(flat, element)
        : Object.values(selectors ?? {})
            .filter(item => item.type === 'class' && item.name !== value)
            .map(item => item.name)
            .sort((a, b) => a.localeCompare(b)),
    [element, flat, mode, selectors, value]
  );
  const ancestors = useMemo(
    () => ancestorOptions(ancestorCandidates, configuredAncestors),
    [ancestorCandidates, configuredAncestors]
  );
  const conditions = useMemo(() => ancestorConditions(configuredAncestors), [configuredAncestors]);
  const unused = useMemo(() => (selector ? unusedAncestors(flat, selector) : new Set<string>()), [flat, selector]);
  const ancestorPlaceholder = useMemo(() => {
    const count = Object.keys(configuredAncestors ?? {}).length;

    return count ? `When an ancestor is… (${count} set)` : 'When an ancestor is…';
  }, [configuredAncestors]);
  // With an ancestor, the variants on offer are that class's own, plus any already styled against it
  const variants = useMemo(() => {
    const block = selector?.attributes[styleSelector];
    const names = styleAncestor
      ? [
          ...Object.keys(selectors?.[styleAncestor]?.attributes.base.variants ?? {}),
          ...Object.keys(block?.ancestors?.[styleAncestor]?.variants ?? {})
        ]
      : Object.keys(block?.variants ?? {});

    return [...new Set(names)].map(variant => ({ label: variant, value: variant }));
  }, [selector?.attributes, selectors, styleAncestor, styleSelector]);

  useEffect(() => {
    setStyleSelector('base');
    if (mode !== 'element') {
      return;
    }

    const selectorNames = get(styleSelectors, 'base', '').split(' ');
    const selector = selectorNames[selectorNames.length - 1];
    onChange?.(selector ? selector : '');
    setStyleState(undefined);
    setStyleAncestor(undefined);
    setComponentSubType(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, styleSelectors]);

  useDidUpdateEffect(() => {
    if (mode !== 'element') {
      return;
    }

    if (value !== element?.definition.type) {
      const selectorNames = get(styleSelectors, styleSelector, '').split(' ');
      onChange?.(selectorNames[selectorNames.length - 1]);
    }
    setStyleState(undefined);
    setStyleVariant(undefined);
    setStyleAncestor(undefined);
    setComponentSubType(undefined);
  }, [styleSelector]);

  useDidUpdateEffect(() => {
    setStyleState(undefined);
    setStyleVariant(undefined);
    setStyleAncestor(undefined);
    setComponentSubType(undefined);
  }, [value]);

  const handleAddSelector = useCallback(
    (selector: SelectorValue, isDuplicated: boolean, originalSelector?: SelectorValue) => {
      if (isDuplicated && !originalSelector) {
        return;
      }

      const { name, type } = selector;
      if (!isDuplicated && name !== '' && !selectors?.[name]) {
        builderHandler('styleAddSelector', displayMode, name, type, undefined, undefined, {
          styleSelector,
          componentType: type === 'element' ? componentType : undefined
        });
      } else if (
        isDuplicated &&
        originalSelector &&
        originalSelector.name !== name &&
        selectors?.[originalSelector.name] &&
        !(selectors[name] as StyleItem | undefined)
      ) {
        builderHandler(
          'styleAddSelector',
          displayMode,
          name,
          type,
          undefined,
          get(selectors, `${originalSelector.name}.attributes.${styleSelector}.default`, {}),
          { styleSelector, componentType: type === 'element' ? componentType : undefined }
        );
      }
    },
    [builderHandler, componentType, displayMode, selectors, styleSelector]
  );

  const handleSelectSelector = useCallback(
    (selector?: Pick<StyleItem, 'name' | 'type'>) => {
      if (!selector || (value && value === selector.name)) {
        onChange?.(undefined);

        return;
      }

      onChange?.(selector.name);
    },
    [onChange, value]
  );

  const handleChangeSelector = useCallback(
    (value: string) => {
      if (!element) {
        return;
      }

      builderHandler(
        'schemaUpdateElement',
        produce(element, draft => {
          set(draft, `definition.styleSelectors.${styleSelector}`, value);
        })
      );
    },
    [element, builderHandler, styleSelector]
  );

  const handleRemoveSelector = useCallback(
    (selectorRemoved: { name: string; type: TagType }) => {
      builderHandler('styleRemoveSelector', displayMode, selectorRemoved.name);
    },
    [builderHandler, displayMode]
  );

  const handleChangeComponentSubType = useCallback((value: string) => setComponentSubType(value), []);

  const handleChangeStyleSelector = useCallback((value: string) => {
    setStyleSelector(value);
  }, []);

  const handleChangeStyleState = useCallback(
    (option?: Exclude<Option, OptionGroup>) => setStyleState(option?.value as StyleState),
    []
  );

  const handleChangeStyleAncestor = useCallback((option?: Exclude<Option, OptionGroup>) => {
    setStyleAncestor(option?.value);
    setStyleState(undefined);
    setStyleVariant(undefined);
  }, []);

  const handleRemoveStyleAncestor = useCallback(
    (option: Exclude<Option, OptionGroup>) => {
      if (option.value === styleAncestor) {
        setStyleAncestor(undefined);
        setStyleState(undefined);
        setStyleVariant(undefined);
      }

      if (!selector?.attributes[styleSelector]?.ancestors?.[option.value]) {
        return;
      }

      builderHandler('styleUpdateSelector', displayMode, selector.name, undefined, undefined, {
        styleSelector,
        styleAncestor: option.value,
        componentType: selector.componentType
      });
    },
    [builderHandler, displayMode, selector, styleAncestor, styleSelector]
  );

  const handleSelectCondition = useCallback((condition: AncestorCondition) => {
    setStyleAncestor(condition.ancestor);
    setStyleVariant(condition.variant);
    setStyleState(condition.state);
  }, []);

  const handleRemoveCondition = useCallback(
    (condition: AncestorCondition) => {
      if (!selector) {
        return;
      }

      const { ancestor, state, variant } = condition;
      if (ancestor === styleAncestor && state === styleState && variant === styleVariant) {
        setStyleState(undefined);
        setStyleVariant(undefined);
      }

      // The rules that hold inside the ancestor always are cleared with an empty set: no value would purge it all
      builderHandler('styleUpdateSelector', displayMode, selector.name, undefined, state || variant ? undefined : {}, {
        styleSelector,
        styleAncestor: ancestor,
        styleState: state,
        styleVariant: variant,
        componentType: selector.componentType
      });
    },
    [builderHandler, displayMode, selector, styleAncestor, styleSelector, styleState, styleVariant]
  );

  const handleRemoveUnused = useCallback(() => {
    if (!selector) {
      return;
    }

    if (styleAncestor && unused.has(styleAncestor)) {
      setStyleAncestor(undefined);
      setStyleState(undefined);
      setStyleVariant(undefined);
    }

    for (const removal of ancestorRemovals(platform, selector.name, unused)) {
      builderHandler('styleUpdateSelector', removal.displayMode, selector.name, undefined, undefined, {
        styleSelector: removal.styleSelector,
        styleAncestor: removal.styleAncestor,
        componentType: selector.componentType
      });
    }
  }, [builderHandler, platform, selector, styleAncestor, unused]);

  const handleChangeStyleVariant = useCallback((option?: Exclude<Option, OptionGroup>) => {
    setStyleVariant(option?.value);
  }, []);

  const handleRemoveStyleVariant = useCallback(
    (option: Exclude<Option, OptionGroup>) => {
      onRemoveVariant?.(option.value);
      if (styleState) {
        setStyleState(undefined);
      }

      if (option.value === styleVariant) {
        setStyleVariant(undefined);
      }

      builderHandler('styleUpdateSelector', displayMode, selector?.name, undefined, undefined, {
        styleSelector,
        styleVariant: option.value,
        styleAncestor,
        componentType: selector?.componentType
      });
    },
    [
      builderHandler,
      displayMode,
      onRemoveVariant,
      selector?.componentType,
      selector?.name,
      styleSelector,
      styleState,
      styleVariant,
      styleAncestor
    ]
  );

  const hasControls =
    allowStyleVariant || allowStyleState || !!styleSelectorsAvailables?.length || !!componentSubTypesAvailables?.length;

  return (
    <div className="flex w-full grow flex-col gap-2">
      <div className="flex w-full flex-col gap-2 px-1">
        {mode === 'element' && (
          <Selector
            className="min-h-0 w-full"
            value={selectorName}
            selectors={selectors}
            selector={selector}
            componentType={componentType}
            onAdd={handleAddSelector}
            onChange={handleChangeSelector}
            onRemove={handleRemoveSelector}
            onSelectorSelected={handleSelectSelector}
          />
        )}
        {hasControls && (
          <div className={clsx('flex w-full items-center gap-2', { 'mt-2': mode === 'manager' })}>
            {!!componentSubTypesAvailables?.length && (
              <Select
                className="grow basis-0"
                size="xs"
                value={componentSubType}
                onChange={handleChangeComponentSubType}
              >
                {componentSubTypesAvailables.map(subType => (
                  <option key={subType} value={subType}>
                    {subType}
                  </option>
                ))}
              </Select>
            )}
            {allowStyleSelector && styleSelectorsAvailables && styleSelectorsAvailables.length > 1 && (
              <Select className="grow basis-0" size="xs" onChange={handleChangeStyleSelector} value={styleSelector}>
                {styleSelectorsAvailables.map(selectorKey => (
                  <option key={selectorKey} value={selectorKey}>
                    {selectorKey}
                  </option>
                ))}
              </Select>
            )}
            {allowStyleVariant && (
              <div className="grow basis-0">
                <Select2
                  className="grow basis-0"
                  value={styleVariant}
                  options={variants}
                  placeholder="Variant"
                  size="xs"
                  allowCreateOptions
                  allowRemoveOptions
                  clearable
                  onChange={handleChangeStyleVariant}
                  onRemove={handleRemoveStyleVariant}
                />
              </div>
            )}
            {allowStyleState && (
              <div className="grow basis-0">
                <Select2
                  className="grow basis-0"
                  value={styleState}
                  options={STYLE_STATE_OPTIONS}
                  placeholder="State"
                  size="xs"
                  clearable
                  onChange={handleChangeStyleState}
                />
              </div>
            )}
          </div>
        )}
        {hasControls && allowStyleState && !!ancestors.length && (
          <Select2
            className="w-full"
            value={styleAncestor}
            options={ancestors}
            placeholder={ancestorPlaceholder}
            size="xs"
            clearable
            allowRemoveOptions
            onChange={handleChangeStyleAncestor}
            onRemove={handleRemoveStyleAncestor}
          />
        )}
        {allowStyleState && conditions.length > 0 && (
          <AncestorRules
            conditions={conditions}
            unused={unused}
            activeAncestor={styleAncestor}
            activeState={styleState}
            activeVariant={styleVariant}
            onSelect={handleSelectCondition}
            onRemove={handleRemoveCondition}
            onRemoveUnused={handleRemoveUnused}
          />
        )}
      </div>
      <div className="flex grow basis-0 flex-col overflow-auto border-t border-gray-300 dark:border-zinc-700">
        <Inspector
          selectors={selectorsFiltered}
          componentType={componentType}
          selector={selector}
          styleSelector={styleSelector}
          styleState={styleState}
          styleVariant={styleVariant}
          styleAncestor={styleAncestor}
          element={element}
          displayMode={displayMode}
          mode={mode}
        />
      </div>
    </div>
  );
};

export default StyleInspector;
