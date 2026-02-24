import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import { debounce } from '@plitzi/plitzi-ui/helpers';
import deepEqual from '@plitzi/plitzi-ui/utils/deepEqual';
import { useCallback, use, useMemo, useState, useRef } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import styleConstants from '@plitzi/sdk-shared/style/styleConstants';

import { processSelectorsMultiLine } from '../../../helpers';
import { cssToSelectors, getReadOnlyRangesFromContent } from '../../../helpers/formatCssFromSelector';

import type { EditorState, AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { DisplayMode, StyleBaseItem, StyleItem, StyleVariableCategory, StyleVariables } from '@plitzi/sdk-shared';

export type InspectorModeAdvancedProps = {
  selectors: StyleItem[];
  displayMode: DisplayMode;
  styleVariables?: Partial<StyleVariables>;
};

const InspectorModeAdvanced = ({ selectors, displayMode, styleVariables }: InspectorModeAdvancedProps) => {
  const selectorsRef = useRef(selectors);
  selectorsRef.current = selectors;
  const [reRender, setReRender] = useState(false);
  const { builderHandler } = use(BuilderContext);
  const { useDataSource } = use(DataSourceContext);
  const { variables: schemaVariables } = useDataSource<Record<string, unknown>>({ id: '', mode: 'read' });
  const CMValue = useMemo(
    () => processSelectorsMultiLine(selectors, 2).join('\n\n'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectors, reRender]
  );
  const variablesNames = useMemo<AutoComplete[]>(
    () => [
      ...Object.keys(schemaVariables).reduce<AutoComplete[]>(
        (acum, variableKey) => [...acum, { type: 'css-token' as const, value: variableKey }],
        []
      ),
      ...(Object.keys(styleVariables ?? {}) as StyleVariableCategory[]).flatMap(variableCategory =>
        Object.keys(styleVariables?.[variableCategory] ?? {}).reduce<AutoComplete[]>(
          (acum, variableKey) => [...acum, { type: 'css-token' as const, value: variableKey }],
          []
        )
      )
    ],
    [schemaVariables, styleVariables]
  );

  const sync = useCallback(
    (currentState: string) => {
      if (selectorsRef.current.length === 0) {
        return;
      }

      const newSelectors = cssToSelectors(currentState);
      selectorsRef.current.forEach(selectorItem => {
        const newSelector = newSelectors[selectorItem.name] as StyleBaseItem | undefined;
        if (newSelector && !deepEqual(selectorItem.attributes, newSelector.attributes)) {
          builderHandler(
            'styleUpdateSelector',
            displayMode,
            newSelector.name,
            selectorItem.type,
            undefined,
            newSelector.attributes
          );
        }
      });
    },
    [builderHandler, displayMode]
  );

  const syncDebounced = useMemo(() => debounce(sync, 500), [sync]);

  const handleChange = useCallback((newValue: string) => syncDebounced(newValue), [syncDebounced]);

  const handleClickFormat = useCallback(() => setReRender(state => !state), []);

  const getReadOnlyRanges = useCallback((targetState: EditorState) => {
    const content = (targetState.doc as unknown as { text: string[] }).text.reduce(
      (acum: string, line: string) => `${acum}${acum ? '\n' : ''}${line}`,
      ''
    );

    return getReadOnlyRangesFromContent(content);
  }, []);

  const handleBlur = useCallback(() => setReRender(state => !state), []);

  return (
    <div className="relative flex grow flex-col">
      <CodeMirror
        value={CMValue}
        className="h-full"
        theme="dark"
        lineWrapping
        onChange={handleChange}
        onBlur={handleBlur}
        autoComplete={variablesNames}
        getReadOnlyRanges={getReadOnlyRanges}
      />
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <ContainerFloating>
          <ContainerFloating.Trigger>
            <Button intent="custom" size="custom" className="rounded-sm bg-white p-2">
              <Button.Icon icon="fa-solid fa-circle-info" />
            </Button>
          </ContainerFloating.Trigger>
          <ContainerFloating.Content>
            <div className="flex w-60 flex-col justify-center gap-1 p-4 text-xs">
              <p className="text-xs">Add your own CSS code here to customize the appearance and layout of your site.</p>
              <span className="font-bold">Properties Allowed</span>
              <ul className="flex h-[100px] flex-col overflow-auto rounded-sm border border-gray-300 text-xs">
                {Object.values(styleConstants).map((property, i: number) => (
                  <li key={i} className="w-full border-gray-300 px-1.5 py-1 [&:not(:last-child)]:border-b">
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
          className="rounded-sm bg-white p-2"
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
