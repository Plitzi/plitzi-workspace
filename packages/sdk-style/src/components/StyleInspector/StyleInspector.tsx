import Button from '@plitzi/plitzi-ui/Button';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Select from '@plitzi/plitzi-ui/Select';
import classNames from 'classnames';
import get from 'lodash/get';
import { use, useCallback, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-elements/ComponentContext';

import Selector from '../Selector';

import type { SelectorValue } from '../Selector';
import type { DisplayMode, Element, Style, StyleItem } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type StyleInspectorProps = {
  element: Element;
  mode?: 'element' | 'manager';
  styleSelectors?: Element['definition']['styleSelectors'];
  allowStyleSelector?: boolean;
  displayMode: DisplayMode;
  // Extras
  style: Style;
  selectorSelected?: Pick<StyleItem, 'name' | 'type'>;
  setSelectorSelected?: Dispatch<SetStateAction<SelectorValue | undefined>>;
  styleSelector: string;
  setStyleSelector: (selector: string) => void;
  // methods
  onAdd?: (tag: SelectorValue, isDuplicated: boolean, originalTag?: SelectorValue) => void;
  onChange?: (value: string) => void;
  onRemove?: (selector: string) => void;
};

const StyleInspector = ({
  element,
  mode = 'element',
  styleSelectors,
  allowStyleSelector = true,
  displayMode,
  // Extras
  style,
  selectorSelected,
  setSelectorSelected,
  styleSelector,
  setStyleSelector,
  onAdd,
  onChange,
  onRemove
}: StyleInspectorProps) => {
  const [cache, setCache] = useStorage<{ viewMode: 'basic' | 'advanced' }>('StyleInspector', { viewMode: 'basic' });
  const selector = useMemo(() => get(styleSelectors, styleSelector, ''), [styleSelectors, styleSelector]);
  // const selectors = Object.values(get(style.platform, displayMode));
  const { componentDefinitions } = use(ComponentContext);
  const styleSelectorsAvailables = useMemo<Element['definition']['styleSelectors']>(
    () =>
      get(
        componentDefinitions,
        `${get(element, 'definition.type', '')}.definition.styleSelectors`,
        {}
      ) as Element['definition']['styleSelectors'],
    [componentDefinitions, element]
  );

  const handleClicViewMode = useCallback(
    () => setCache(state => ({ viewMode: state.viewMode === 'basic' ? 'advanced' : 'basic' })),
    [setCache]
  );

  const handleChangeStyleSelector = useCallback((value: string) => setStyleSelector(value), [setStyleSelector]);

  return (
    <div className="w-full flex flex-col grow">
      <div className="flex flex-col w-full p-2 border-b border-gray-300">
        {allowStyleSelector && (
          <div className="flex flex-col text-xs">
            <label>Selector</label>
            <Select className="rounded-sm" size="sm" onChange={handleChangeStyleSelector} value={styleSelector}>
              {Object.keys(styleSelectorsAvailables).map(selectorKey => (
                <option key={selectorKey} value={selectorKey}>
                  {selectorKey}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className={classNames('flex w-full', { 'mt-2': allowStyleSelector })}>
          <Selector
            className="w-full min-h-[34px]"
            style={style}
            disabled={mode === 'manager'}
            value={selector}
            selectorSelected={selectorSelected}
            displayMode={displayMode}
            onAdd={onAdd}
            onChange={onChange}
            onRemove={onRemove}
            onSelectorSelected={setSelectorSelected}
          />
          <Button
            className="rounded-sm ml-2 w-10 text-sm"
            size="custom"
            onClick={handleClicViewMode}
            title={cache.viewMode === 'basic' ? 'Advanced Mode' : 'Basic Mode'}
            disabled={selectorSelected?.name.includes(':')}
          >
            {cache.viewMode === 'basic' && <i className="fa-solid fa-code" />}
            {cache.viewMode === 'advanced' && <i className="fa-regular fa-hand-pointer" />}
          </Button>
        </div>
      </div>
      <div className="flex flex-col grow overflow-auto basis-0">
        {/* {viewMode === 'advanced' && (
          <InspectorModeAdvanced
            styleSelector={styleSelector}
            selectors={selectors}
            selector={selectorSelected?.name}
            element={element}
          />
        )}
        {viewMode === 'basic' && (
          <InspectorModeBasic styleSelector={styleSelector} selector={selectorSelected?.name} element={element} />
        )} */}
      </div>
    </div>
  );
};

export default StyleInspector;
