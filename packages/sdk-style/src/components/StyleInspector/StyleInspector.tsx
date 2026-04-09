import { get, set, pick } from '@plitzi/plitzi-ui/helpers';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { clsx } from 'clsx';
import { produce } from 'immer';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import Selector from '../Selector';
import Inspector from './Inspector';

import type { SelectorValue } from '../Selector';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { BuilderState, Element, StyleItem, TagType } from '@plitzi/sdk-shared';
import type { StyleState } from '@plitzi/sdk-shared';

export type StyleInspectorProps = {
  value?: string;
  element?: Element;
  componentType?: string;
  mode?: 'element' | 'manager';
  styleSelectors?: Record<string, string>;
  styleSelectorsAvailables?: string[];
  allowStyleSelector?: boolean;
  allowStyleState?: boolean;
  allowStyleVariant?: boolean;
  onChange?: (selector?: string) => void;
  onRemoveVariant?: (variant: string) => void;
};

const StyleInspector = ({
  value,
  element,
  mode = 'element',
  componentType,
  styleSelectors,
  styleSelectorsAvailables,
  allowStyleSelector = true,
  allowStyleState = true,
  allowStyleVariant = true,
  onChange,
  onRemoveVariant
}: StyleInspectorProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[style, platform, displayMode]] = useStore(['style', 'style.platform', 'displayMode']);
  const [styleSelector, setStyleSelector] = useState('base');
  const [styleVariant, setStyleVariant] = useState<string | undefined>(undefined);
  const [styleState, setStyleState] = useState<StyleState | undefined>(undefined);
  const { builderHandler } = use(BuilderContext);
  const selectorName = useMemo(() => get(styleSelectors, styleSelector, ''), [styleSelectors, styleSelector]);
  const selectors = useMemo(
    () =>
      Object.values(
        pick(
          get(style.platform, displayMode),
          element ? [element.definition.type, ...selectorName.split(' ')] : selectorName.split(' ')
        )
      ),
    [style.platform, displayMode, element, selectorName]
  );
  const selector = useMemo<StyleItem | undefined>(
    () => get(style, `platform.${displayMode}.${value}`),
    [style, displayMode, value]
  );
  const variants = useMemo(
    () =>
      Object.keys(selector?.attributes[styleSelector].variants ?? {}).map(variant => ({
        label: variant,
        value: variant
      })),
    [selector?.attributes, styleSelector]
  );

  useEffect(() => {
    setStyleSelector('base');
    if (mode !== 'element') {
      return;
    }

    const selectorNames = get(styleSelectors, 'base', '').split(' ');
    const selector = selectorNames[selectorNames.length - 1];
    onChange?.(selector ? selector : '');
    setStyleState(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, styleSelectors]);

  useDidUpdateEffect(() => {
    if (mode !== 'element') {
      return;
    }

    const selectorNames = get(styleSelectors, styleSelector, '').split(' ');
    onChange?.(selectorNames[selectorNames.length - 1]);
    setStyleState(undefined);
    setStyleVariant(undefined);
  }, [styleSelector]);

  useDidUpdateEffect(() => {
    setStyleState(undefined);
    setStyleVariant(undefined);
  }, [value]);

  const handleAddSelector = useCallback(
    (selector: SelectorValue, isDuplicated: boolean, originalSelector?: SelectorValue) => {
      if (isDuplicated && !originalSelector) {
        return;
      }

      const { name, type } = selector;
      if (!isDuplicated && name !== '' && !(platform[displayMode][name] as StyleItem | undefined)) {
        builderHandler('styleAddSelector', displayMode, name, type, undefined, undefined, {
          styleSelector,
          componentType: type === 'element' ? componentType : undefined
        });
      } else if (
        isDuplicated &&
        originalSelector &&
        originalSelector.name !== name &&
        (platform[displayMode][originalSelector.name] as StyleItem | undefined) &&
        !(platform[displayMode][name] as StyleItem | undefined)
      ) {
        builderHandler(
          'styleAddSelector',
          displayMode,
          name,
          type,
          undefined,
          get(platform, `${displayMode}.${originalSelector.name}.attributes`, {}),
          { styleSelector, componentType: type === 'element' ? componentType : undefined }
        );
      }
    },
    [builderHandler, componentType, displayMode, platform, styleSelector]
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

  const handleChangeStyleSelector = useCallback((value: string) => {
    setStyleSelector(value);
  }, []);

  const handleChangeStyleState = useCallback(
    (option?: Exclude<Option, OptionGroup>) => setStyleState(option?.value as StyleState),
    []
  );

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
        styleState,
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
      styleVariant
    ]
  );

  return (
    <div className="flex w-full grow flex-col gap-2">
      <div className="flex w-full flex-col gap-2 px-1">
        {mode === 'element' && (
          <Selector
            className="min-h-0 w-full"
            style={style}
            value={selectorName}
            selector={selector}
            componentType={componentType}
            displayMode={displayMode}
            onAdd={handleAddSelector}
            onChange={handleChangeSelector}
            onRemove={handleRemoveSelector}
            onSelectorSelected={handleSelectSelector}
          />
        )}
        {(allowStyleSelector || allowStyleState) && (
          <div className={clsx('flex w-full items-center gap-2', { 'mt-2': mode === 'manager' })}>
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
                  options={[
                    { label: 'Hover', value: 'hover' },
                    { label: 'Focus', value: 'focus' },
                    { label: 'Active', value: 'active' },
                    { label: 'Disabled', value: 'disabled' }
                  ]}
                  placeholder="State"
                  size="xs"
                  clearable
                  onChange={handleChangeStyleState}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex grow basis-0 flex-col overflow-auto border-t border-gray-300 dark:border-zinc-700">
        <Inspector
          selectors={selectors}
          componentType={componentType}
          selector={selector}
          styleSelector={styleSelector}
          styleState={styleState}
          styleVariant={styleVariant}
          element={element}
          displayMode={displayMode}
          mode={mode}
        />
      </div>
    </div>
  );
};

export default StyleInspector;
