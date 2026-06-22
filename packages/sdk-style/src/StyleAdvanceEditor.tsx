import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import { get, debounce } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useState, use } from 'react';

import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { StyleVariableCategory } from '@plitzi/sdk-shared';

const StyleAdvanceEditor = () => {
  const { theme } = use(ThemeContext);
  const [[customCssProp = '', styleVariables = undefined]] = useCommonStore([
    'schema.settings.customCss',
    'style.variables'
  ]);
  const { schemaUpdateSettings } = use(SchemaContext);
  const [customCss, setCustomCss] = useState(() => {
    if (typeof customCssProp !== 'string') {
      return '';
    }

    return customCssProp;
  });
  const schemaUpdateSettingsDebounce = useMemo(
    () => schemaUpdateSettings && debounce(schemaUpdateSettings, 500),
    [schemaUpdateSettings]
  );
  const { server, webKey } = use(NetworkContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });

  const handleChange = useCallback(
    (value: string | number | boolean) => {
      schemaUpdateSettingsDebounce?.(value, 'customCss');
      setCustomCss(value as string);
    },
    [setCustomCss, schemaUpdateSettingsDebounce]
  );

  const handleFormat = useCallback(async () => {
    const response = await networkQuery<{ data: string }>(
      '/utils/prettier-parser',
      { data: customCss, parser: 'css' },
      'post'
    );
    if (!response || !response.data) {
      return;
    }

    const customCssPretty = get(response, 'data', customCss);
    if (customCssPretty !== customCss) {
      setCustomCss(customCssPretty);
      schemaUpdateSettingsDebounce?.(customCssPretty, 'customCss');
    }
  }, [networkQuery, customCss, schemaUpdateSettingsDebounce]);

  const variables = useMemo<AutoComplete[]>(() => {
    if (!styleVariables) {
      return [];
    }

    return Object.keys(styleVariables)
      .flatMap(variableGroup => Object.keys(styleVariables[variableGroup as StyleVariableCategory] ?? {}))
      .map(variable => ({ type: 'css-token', value: variable }));
  }, [styleVariables]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <CodeMirror
        className="h-full"
        value={customCss}
        autoComplete={variables}
        theme={theme === 'dark' ? 'dark' : 'light'}
        lineWrapping
        onChange={handleChange}
      />
      <div className="absolute top-3 right-3 flex">
        <Button
          intent="custom"
          size="custom"
          className="mr-2 rounded-sm bg-white p-2 text-zinc-800 shadow dark:bg-zinc-700 dark:text-zinc-200"
          onClick={handleFormat}
          title="Auto format"
          disabled={networkLoading}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
        </Button>
        <ContainerFloating containerLeftOffset={-208} containerTopOffset={4}>
          <ContainerFloating.Trigger>
            <Button
              intent="custom"
              size="custom"
              className="rounded-sm bg-white p-2 text-zinc-800 shadow dark:bg-zinc-700 dark:text-zinc-200"
            >
              <i className="fa-solid fa-circle-info" />
            </Button>
          </ContainerFloating.Trigger>
          <ContainerFloating.Content>
            <div className="flex w-60 flex-col items-center justify-center p-4 text-center text-zinc-700 dark:text-zinc-300">
              <p>Add your own CSS code here to customize the appearance and layout of your site.</p>
              <a
                href="https://codex.wordpress.org/CSS"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                Learn more about CSS
                <span className="text-sm"> (opens in a new tab)</span>
              </a>
              <p>
                <span className="font-bold">Ctrl + Space</span> to autocomplete.
              </p>
            </div>
          </ContainerFloating.Content>
        </ContainerFloating>
      </div>
    </div>
  );
};

export default StyleAdvanceEditor;
