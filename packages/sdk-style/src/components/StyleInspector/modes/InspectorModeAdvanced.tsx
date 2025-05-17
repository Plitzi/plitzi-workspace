import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import { produce } from 'immer';
import debounce from 'lodash/debounce';
import set from 'lodash/set';
import { useCallback, use, useMemo, useEffect, useState } from 'react';

import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';
import { StyleConstants } from '@plitzi/sdk-shared/style';

import {
  cssToSelectors,
  getReadOnlyRangesFromContent,
  formatCssFromSelector,
  makeSelector
} from '../../../StyleHelper';

import type { EditorState, AutoComplete } from '@plitzi/plitzi-ui';
import type { DisplayMode, Element, StyleItem } from '@plitzi/sdk-shared';

export type InspectorModeAdvancedProps = {
  element?: Element;
  styleSelector: string;
  selectors: StyleItem[];
  selector?: string;
  displayMode: DisplayMode;
};

const InspectorModeAdvanced = ({
  element,
  styleSelector = '',
  selectors,
  selector,
  displayMode
}: InspectorModeAdvancedProps) => {
  const [reRender, setReRender] = useState(false);
  const { builderHandler } = use(BuilderContext);
  const { useDataSource } = use(DataSourceContext);
  const { variables } = useDataSource<Record<string, unknown>>({ id: '', mode: 'read' });
  const selectorInstance = useMemo(
    () => selectors.find(selectorAux => selectorAux.name === selector),
    [selector, selectors]
  );
  const CMValue = useMemo(
    () => (selectorInstance ? (formatCssFromSelector(selectorInstance.cache, true, 2, false) as string) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectorInstance, reRender]
  );
  const variablesNames = useMemo<AutoComplete[]>(
    () =>
      Object.keys(variables).reduce<AutoComplete[]>(
        (acum, variableKey) => [...acum, { type: 'css-token' as const, value: variableKey }],
        []
      ),
    [variables]
  );

  const sync = useCallback(
    (currentState: string, push = true) => {
      const newState = cssToSelectors(currentState, true);
      if (!push) {
        return;
      }

      if (newState.name) {
        builderHandler(
          'styleUpdateSelector',
          displayMode,
          newState.name,
          selectorInstance?.type,
          undefined,
          newState.attributes
        );
      }
    },
    [builderHandler, displayMode, selectorInstance?.type]
  );

  const syncDebounced = useMemo(() => debounce(sync, 500), [sync]);

  const handleChange = useCallback((newValue: string) => syncDebounced(newValue), [syncDebounced]);

  const handleClickFormat = useCallback(() => setReRender(state => !state), []);

  const getReadOnlyRanges = useCallback((targetState: EditorState) => {
    // @ts-expect-error eslint-disable-next-line
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const content = targetState.doc.text.reduce(
      (acum: string, line: string) => `${acum}${acum ? '\n' : ''}${line}`,
      ''
    ) as string;

    return getReadOnlyRangesFromContent(content, false, false);
  }, []);

  useEffect(() => {
    if (element && !selector) {
      const {
        definition: { type }
      } = element;

      const customClass = makeSelector(type, styleSelector);
      builderHandler(
        'schemaUpdateElement',
        produce(element, draft => {
          set(draft, `definition.styleSelectors.${styleSelector}`, customClass);
        })
      );

      builderHandler('styleAddSelector', displayMode, customClass, 'class', undefined, undefined);
    }
  }, [element, selector, builderHandler, styleSelector, displayMode]);

  return (
    <div className="flex flex-col grow relative">
      <CodeMirror
        value={CMValue}
        theme="dark"
        lineWrapping
        onChange={handleChange}
        autoComplete={variablesNames}
        getReadOnlyRanges={getReadOnlyRanges}
      />
      <div className="flex flex-col absolute top-3 right-3 gap-1">
        <ContainerFloating containerLeftOffset={-208}>
          <ContainerFloating.Trigger>
            <Button intent="custom" size="custom" className="p-2 bg-white rounded-sm">
              <i className="fa-solid fa-circle-info" />
            </Button>
          </ContainerFloating.Trigger>
          <ContainerFloating.Content>
            <div className="w-60 flex flex-col justify-center p-4 gap-1 text-xs ">
              <p className="text-xs">Add your own CSS code here to customize the appearance and layout of your site.</p>
              <span className="font-bold">Properties Allowed</span>
              <ul className="text-xs border border-gray-300 rounded-sm h-[100px] overflow-auto flex flex-col">
                {Object.values(StyleConstants).map((property, i: number) => (
                  <li key={i} className="px-1.5 py-1 [&:not(:last-child)]:border-b border-gray-300 w-full">
                    {property as string}
                  </li>
                ))}
              </ul>
              <p className="text-xs">
                <span className="font-bold">Tab</span> to autocomplete.
              </p>
            </div>
          </ContainerFloating.Content>
        </ContainerFloating>
        <Button
          intent="custom"
          size="custom"
          className="p-2 bg-white rounded-sm"
          onClick={handleClickFormat}
          iconPlacement="before"
          // disabled={networkLoading}
          title="Auto Format"
        >
          <Button.Icon icon="fa-solid fa-wand-magic-sparkles" />
        </Button>
      </div>
    </div>
  );
};

export default InspectorModeAdvanced;
