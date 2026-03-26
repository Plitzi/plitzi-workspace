import { get, set, pick } from '@plitzi/plitzi-ui/helpers';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Select from '@plitzi/plitzi-ui/Select';
import Switch from '@plitzi/plitzi-ui/Switch';
import { produce } from 'immer';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

import Selector from '../Selector';
import InspectorModeAdvanced from './modes/InspectorModeAdvanced';
import InspectorModeBasic from './modes/InspectorModeBasic';

import type { SelectorValue } from '../Selector';
import type { Element, StyleItem, TagType } from '@plitzi/sdk-shared';
import type { StyleState } from '@plitzi/sdk-shared';

export type StyleInspectorProps = {
  value?: string;
  element?: Element;
  componentType?: string;
  mode?: 'element' | 'manager';
  styleSelectors?: Element['definition']['styleSelectors'];
  styleSelectorsAvailables?: string[];
  allowStyleSelector?: boolean;
  allowStyleState?: boolean;
  onChange?: (selector?: string) => void;
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
  onChange
}: StyleInspectorProps) => {
  const [viewMode, setViewMode] = useStorage<'basic' | 'advanced'>('builder-state.styleInspector.viewMode', 'basic');
  const {
    style,
    displayMode,
    style: { platform, variables }
  } = use(BuilderStyleContext);
  const [styleSelector, setStyleSelector] = useState('base');
  const [styleState, setStyleState] = useState<StyleState | undefined>(undefined);
  const { builderHandler } = use(BuilderContext);
  const selectorName = useMemo(() => get(styleSelectors, styleSelector, ''), [styleSelectors, styleSelector]);
  const selectors = useMemo(
    () => Object.values(pick(get(style.platform, displayMode), selectorName.split(' '))),
    [style, displayMode, selectorName]
  );
  const selector = useMemo<StyleItem | undefined>(
    () => get(style, `platform.${displayMode}.${value}`),
    [style, displayMode, value]
  );

  useEffect(() => {
    setStyleSelector('base');
    if (mode !== 'element') {
      return;
    }

    const selectors = get(styleSelectors, 'base', '').split(' ');
    const selector = selectors[selectors.length - 1];
    onChange?.(selector ? selector : '');
    setStyleState(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, styleSelectors]);

  useDidUpdateEffect(() => {
    if (mode !== 'element') {
      return;
    }

    const selectors = get(styleSelectors, styleSelector, '').split(' ');
    onChange?.(selectors[selectors.length - 1]);
    setStyleState(undefined);
  }, [styleSelector]);

  useDidUpdateEffect(() => {
    setStyleState(undefined);
  }, [value]);

  const handleAddSelector = useCallback(
    (selector: SelectorValue, isDuplicated: boolean, originalSelector?: SelectorValue) => {
      if (isDuplicated && !originalSelector) {
        return;
      }

      const { name, type } = selector;
      if (!isDuplicated && name !== '' && !(platform[displayMode][name] as StyleItem | undefined)) {
        builderHandler('styleAddSelector', displayMode, name, type, undefined, undefined, {
          styleSelector: undefined,
          componentType
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
          { styleSelector: undefined, componentType }
        );
      }
    },
    [builderHandler, componentType, displayMode, platform]
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

  const handleClicViewMode = useCallback(
    () => setViewMode(state => (state === 'basic' ? 'advanced' : 'basic')),
    [setViewMode]
  );

  const handleChangeStyleSelector = useCallback((value: string) => {
    setStyleSelector(value);
  }, []);

  const handleChangeStyleState = useCallback((value: string) => setStyleState(value as StyleState), []);

  return (
    <div className="flex w-full grow flex-col gap-2">
      <div className="flex w-full flex-col gap-2 px-1">
        <div className="flex items-center justify-between px-1">
          <label>Style Selector</label>
          <div className="flex items-center gap-2 py-1 text-xs">
            Dev Mode
            <Switch
              size="sm"
              intent="secondary"
              checked={viewMode === 'advanced'}
              onChange={handleClicViewMode}
              disabled={selector?.name.includes(':')}
            />
          </div>
        </div>
        {mode === 'element' && viewMode === 'basic' && (
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
          <div className="flex w-full items-center gap-2">
            {allowStyleSelector && styleSelectorsAvailables && styleSelectorsAvailables.length > 1 && (
              <Select className="grow basis-0" size="xs" onChange={handleChangeStyleSelector} value={styleSelector}>
                {styleSelectorsAvailables.map(selectorKey => (
                  <option key={selectorKey} value={selectorKey}>
                    {selectorKey}
                  </option>
                ))}
              </Select>
            )}
            {allowStyleState && (
              <Select className="grow basis-0" size="xs" onChange={handleChangeStyleState} value={styleState}>
                <option value="">None</option>
                <option value="hover">Hover</option>
                <option value="focus">Focus</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            )}
          </div>
        )}
      </div>
      <div className="flex grow basis-0 flex-col overflow-auto border-t border-gray-300">
        {viewMode === 'advanced' && (
          <InspectorModeAdvanced selectors={selectors} displayMode={displayMode} styleVariables={variables} />
        )}
        {viewMode === 'basic' && (
          <InspectorModeBasic
            componentType={componentType}
            styleSelector={styleSelector}
            selector={selector}
            styleState={styleState}
            element={element}
            displayMode={displayMode}
          />
        )}
      </div>
    </div>
  );
};

export default StyleInspector;
