import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { get, debounce } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useState, use } from 'react';

import { useNetwork } from '@plitzi/sdk-shared/hooks';
import { NetworkContext } from '@plitzi/sdk-shared/network';
import { SchemaContext } from '@plitzi/sdk-shared/schema/react';
import { useCommonStore } from '@plitzi/sdk-shared/store';
import { splitNotificationsCss, withNotificationsCss } from '@plitzi/sdk-shared/style';
import { useTheme } from '@plitzi/sdk-shared/theme';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';

const StyleAdvanceEditor = () => {
  const { resolvedTheme } = useTheme();
  const [[customCssProp = '', styleVariables = undefined]] = useCommonStore([
    'schema.settings.customCss',
    'style.variables'
  ]);
  const { schemaUpdateSettings } = use(SchemaContext);
  // The notifications' look is written into the same string as a rule of its own, and edited in the space's settings:
  // this editor shows the space's own CSS without it, and keeps it when that CSS is saved.
  const stored = useMemo(
    () => splitNotificationsCss(typeof customCssProp === 'string' ? customCssProp : ''),
    [customCssProp]
  );
  const [customCss, setCustomCss] = useState(() => stored.customCss);
  const schemaUpdateSettingsDebounce = useMemo(
    () => schemaUpdateSettings && debounce(schemaUpdateSettings, 500),
    [schemaUpdateSettings]
  );
  const { server, webKey } = use(NetworkContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });

  const save = useCallback(
    (own: string) => schemaUpdateSettingsDebounce?.(withNotificationsCss(own, stored.notifications), 'customCss'),
    [schemaUpdateSettingsDebounce, stored.notifications]
  );

  const handleChange = useCallback(
    (value: string | number | boolean) => {
      save(String(value));
      setCustomCss(String(value));
    },
    [save]
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
      save(customCssPretty);
    }
  }, [networkQuery, customCss, save]);

  const variables = useMemo<AutoComplete[]>(() => {
    if (!styleVariables) {
      return [];
    }

    return Object.values(styleVariables)
      .flatMap(variableGroup => Object.keys(variableGroup))
      .map(variable => ({ type: 'css-token', value: variable }));
  }, [styleVariables]);

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <div className="flex flex-col items-end gap-2">
        <p className="self-stretch text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          CSS of your own for the whole space, past what the style inspector writes.{' '}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Ctrl + Space</span> completes a token.{' '}
          <a
            href="https://developer.mozilla.org/docs/Web/CSS"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-text underline"
          >
            About CSS
          </a>
        </p>
        <Button size="xs" intent="secondary" iconPlacement="before" disabled={networkLoading} onClick={handleFormat}>
          <Button.Icon icon="fa-solid fa-wand-magic-sparkles" />
          Format
        </Button>
      </div>
      <CodeMirror
        className="min-h-0 grow overflow-hidden rounded-md border border-gray-300 dark:border-zinc-700"
        value={customCss}
        autoComplete={variables}
        theme={resolvedTheme}
        lineWrapping
        onChange={handleChange}
      />
    </div>
  );
};

export default StyleAdvanceEditor;
