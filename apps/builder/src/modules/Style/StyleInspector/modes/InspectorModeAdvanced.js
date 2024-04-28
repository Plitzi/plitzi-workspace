// Packages
import React, { useCallback, use, useMemo, useEffect } from 'react';
import debounce from 'lodash/debounce';
import Button from '@plitzi/plitzi-ui-components/Button';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';
import set from 'lodash/set';
import { produce } from 'immer';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import { StyleConstants } from '@plitzi/sdk-style/StyleConstants';
import {
  cssToSelectors,
  getReadOnlyRangesFromContent,
  formatCssFromSelector,
  makeSelector,
  StyleSelectors
} from '@plitzi/sdk-style/StyleHelper';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';

const selectorsDefault = [];

/**
 * @param {{
 *   element: object;
 *   styleSelector: string;
 *   selectors: object[];
 *   selector: string;
 * }} props
 * @returns {React.ReactElement}
 */
const InspectorModeAdvanced = props => {
  const { element, styleSelector = '', selectors = selectorsDefault, selector } = props;
  const { builderHandler } = use(BuilderContext);
  const { displayMode } = use(AppContext);
  const selectorInstance = useMemo(
    () => selectors.find(selectorAux => selectorAux.name === selector),
    [selector, selectors]
  );
  const CMValue = useMemo(
    () => (selectorInstance ? formatCssFromSelector(selectorInstance?.cache, true, 2, false) : ''),
    [selectorInstance?.cache, selectorInstance?.name]
  );

  const sync = useCallback(
    (currentState, push = true) => {
      if (typeof currentState === 'string') {
        currentState = cssToSelectors(currentState, true);
      }

      if (!push) {
        return;
      }

      if (currentState.name) {
        builderHandler(
          EventBridgeTypes.STYLE_UPDATE_SELECTOR,
          displayMode,
          currentState.name,
          selectorInstance?.type,
          undefined,
          currentState.attributes
        );
      }
    },
    [builderHandler, displayMode, selectorInstance?.type]
  );

  const syncDebounced = useMemo(() => debounce(sync, 500), [sync]);

  const handleChange = useCallback(newValue => syncDebounced(newValue), [selectors]);

  const getReadOnlyRanges = useCallback(targetState => {
    const content = targetState.doc.text.reduce((acum, line) => `${acum}${acum ? '\n' : ''}${line}`, '');

    return getReadOnlyRangesFromContent(content, false, false);
  }, []);

  useEffect(() => {
    if (element && !selector) {
      const {
        definition: { type }
      } = element;

      const customClass = makeSelector(type, styleSelector);
      builderHandler(
        EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
        produce(element, draft => {
          set(draft, `definition.styleSelectors.${styleSelector}`, customClass);
        })
      );

      builderHandler(
        EventBridgeTypes.STYLE_ADD_SELECTOR,
        displayMode,
        customClass,
        StyleSelectors.SELECTOR_CLASS,
        undefined,
        undefined
      );
    }
  }, [element, selector, builderHandler, styleSelector]);

  return (
    <div className="flex flex-col grow relative">
      <CodeMirror
        value={CMValue}
        theme="dark"
        lineWrapping
        onChange={handleChange}
        getReadOnlyRanges={getReadOnlyRanges}
      />
      <div className="flex absolute top-3 right-3">
        <Dropdown showIcon={false} containerLeftOffset={-208}>
          <Dropdown.Content>
            <Button intent="custom" size="custom" className="p-2 bg-white rounded">
              <i className="fa-solid fa-circle-info" />
            </Button>
          </Dropdown.Content>
          <Dropdown.Container>
            <div className="w-60 flex flex-col justify-center p-4">
              <p className="text-xs">Add your own CSS code here to customize the appearance and layout of your site.</p>
              <div>
                Properties Allowed
                <ul className="text-xs border border-gray-300 rounded h-[100px] overflow-auto flex flex-col mt-4">
                  {Object.values(StyleConstants).map(property => (
                    <li key={property} className="px-1.5 py-1 not-last:border-b border-gray-300 w-full">
                      {property}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 text-xs">
                <span className="font-bold">Ctrl + Space</span> to autocomplete.
              </p>
            </div>
          </Dropdown.Container>
        </Dropdown>
      </div>
    </div>
  );
};

export default InspectorModeAdvanced;
