// Packages
import React, { useCallback, useContext, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';
import Button from '@plitzi/plitzi-ui-components/Button';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';
import set from 'lodash/set';
import { produce } from 'immer';

// Monorepo
import { EventBridgeTypes } from '@repo/event-bridge-shared/EventBridgeHelper';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';
import { StyleConstants } from '@pmodules/Style/StyleConstants';

// Relatives
import { cssToSelectors, getReadOnlyRangesFromContent, formatCssFromSelector, makeSelector } from '../../StyleHelper';

const selectorsDefault = [];

const InspectorModeAdvanced = props => {
  const { element, styleSelector = '', selectors = selectorsDefault, selector } = props;
  const { builderHandler } = useContext(BuilderContext);
  const { displayMode } = useContext(AppContext);
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
          null,
          currentState.attributes
        );
      }
    },
    [builderHandler]
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
          set(draft, `definition.styleSelectors.${styleSelector}`, `.${customClass}`);
        })
      );

      builderHandler(EventBridgeTypes.STYLE_ADD_SELECTOR, displayMode, `.${customClass}`, undefined, undefined);
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

InspectorModeAdvanced.propTypes = {
  styleSelector: PropTypes.string,
  selectors: PropTypes.array,
  selector: PropTypes.string,
  element: PropTypes.object
};

export default InspectorModeAdvanced;
