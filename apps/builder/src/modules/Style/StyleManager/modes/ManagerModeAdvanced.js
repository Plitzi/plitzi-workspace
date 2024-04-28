// Packages
import React, { useCallback, use, useLayoutEffect, useMemo, useRef } from 'react';
import get from 'lodash/get';
import debounce from 'lodash/debounce';
import Button from '@plitzi/plitzi-ui-components/Button';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

// Monorepo
import EventBridgeTypes from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import { cssToSelectors, StyleConstants, getReadOnlyRangesFromContent } from '@plitzi/sdk-style/StyleHelper';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';

const selectorsDefault = [];

/**
 * @param {{
 *   selectors?: any[];
 *   selected?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ManagerModeAdvanced = props => {
  const { selectors = selectorsDefault, selected } = props;
  const { builderHandler } = use(BuilderContext);
  const { displayMode } = use(AppContext);
  const { server, webKey } = use(NetworkContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const selector = useMemo(() => selectors.find(selectorAux => selectorAux.name === selected), [selected, selectors]);
  const CMRef = useRef({});

  const format = useCallback(
    async content => {
      const response = await networkQuery('/utils/prettier-parser', { data: content, parser: 'css' }, 'post');
      if (!response || !response.data) {
        return content;
      }

      return get(response, 'data', content).replace('}\n', '}');
    },
    [networkQuery]
  );

  const sync = useCallback(
    (currentState, push = true) => {
      if (typeof currentState === 'string') {
        currentState = cssToSelectors(currentState, true);
      }

      if (!push) {
        return;
      }

      builderHandler(
        EventBridgeTypes.STYLE_UPDATE_SELECTOR,
        displayMode,
        currentState.name,
        selector.type,
        undefined,
        currentState.attributes
      );
    },
    [builderHandler, displayMode, selector?.type]
  );

  const syncDebounced = useMemo(() => debounce(sync, 500), [sync]);

  const handleChange = useCallback(
    (newValue, viewUpdate) => {
      CMRef.current.value = newValue;
      if (viewUpdate.selectionSet) {
        syncDebounced(newValue);
      }
    },
    [selectors]
  );

  const reSync = useCallback(
    async content => {
      CMRef.current.value = await format(content);
    },
    [format]
  );

  const getReadOnlyRanges = useCallback(targetState => {
    const content = targetState.doc.text.reduce((acum, line) => `${acum}${acum ? '\n' : ''}${line}`, '');

    return getReadOnlyRangesFromContent(content, false, false);
  }, []);

  useLayoutEffect(() => {
    if (selector && CMRef.current.name !== selector.name) {
      CMRef.current = { name: selector.name, value: '' };
      reSync(selector.cache);
    } else if (selector && CMRef.current.name === selector.name) {
      reSync(selector.cache);
    } else if (!selector) {
      CMRef.current = { name: undefined, value: '' };
    }
  }, [selector]);

  const handleClickFormat = useCallback(() => reSync(CMRef.current.value), []);

  return (
    <div className="h-full flex flex-col relative grow basis-0">
      {selected && (
        <>
          <CodeMirror
            value={CMRef.current.value}
            theme="dark"
            lineWrapping
            onChange={handleChange}
            getReadOnlyRanges={getReadOnlyRanges}
          />
          <div className="flex absolute top-3 right-3">
            <Dropdown showIcon={false} containerLeftOffset={-208} className="mr-2">
              <Dropdown.Content>
                <Button intent="custom" size="custom" className="p-2 bg-white rounded">
                  <i className="fa-solid fa-circle-info" />
                </Button>
              </Dropdown.Content>
              <Dropdown.Container>
                <div className="w-60 flex flex-col justify-center p-4">
                  <p className="text-xs">
                    Add your own CSS code here to customize the appearance and layout of your site.
                  </p>
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
            <Button
              intent="custom"
              size="custom"
              className="p-2 bg-white rounded"
              onClick={handleClickFormat}
              tilte="Auto format"
              disabled={networkLoading}
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
            </Button>
          </div>
        </>
      )}
      {!selected && (
        <div className="m-3 p-3 border-2 border-dashed border-gray-300 rounded text-center select-none">
          No selector or element selected. Click on one to select it.
        </div>
      )}
    </div>
  );
};

export default ManagerModeAdvanced;
