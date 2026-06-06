import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import Select from '@plitzi/plitzi-ui/Select';
import Switch from '@plitzi/plitzi-ui/Switch';
import { useCallback, use, useMemo, useState } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { BuilderState } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

type SettingsProps = {
  query?: string;
  method?: 'get' | 'post';
  accessToken?: string;
  when?: RuleGroup;
  headers?: object;
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
  mockData?: string;
  credentials?: RequestCredentials;
  onUpdate?: (key: string, value: string | boolean | number | object) => void;
};

const Settings = ({
  query = '',
  method = 'get',
  accessToken = '',
  when,
  headers = emptyObject,
  subType = 'div',
  mockData = '{}',
  credentials = 'same-origin',
  onUpdate
}: SettingsProps) => {
  const { theme } = use(ThemeContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [pageDefinitions] = useStore('pageDefinitions');
  const [advancedSettings, setAdvancedSettings] = useState(false);
  const { routeParams, queryParams, currentPageId } = use(NavigationContext);

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeQuery = useCallback((value: string) => onUpdate?.('query', value), [onUpdate]);

  const handleChangeWhen = useCallback((whenQuery: RuleGroup) => onUpdate?.('when', whenQuery), [onUpdate]);

  const handleChangeMockData = useCallback((value: string) => onUpdate?.('mockData', value), [onUpdate]);

  const handleChangeEnabled = useCallback(
    (e: ChangeEvent) => setAdvancedSettings((e.target as HTMLInputElement).checked),
    []
  );

  const handleChangeHeaders = useCallback(
    (_value: unknown, valueObj: object) => onUpdate?.('headers', valueObj),
    [onUpdate]
  );

  const urlParams = useMemo(() => {
    const slug: string = get(pageDefinitions, `${currentPageId}.attributes.slug`, '');

    return [...slug.matchAll(/:[a-z0-9_-]+/gim)].map(match => match[0].slice(1));
  }, [pageDefinitions, currentPageId]);

  const queryParamsAutoComplete = useMemo<AutoComplete[]>(
    () =>
      [...Object.keys(routeParams), ...Object.keys(queryParams), ...urlParams].map(token => ({
        type: 'token',
        value: token
      })),
    [routeParams, queryParams, urlParams]
  );

  return (
    <div className="flex grow flex-col gap-4 py-2">
      <div className="flex flex-col">
        <label>Query</label>
        <CodeMirror
          className="font-rubik min-h-6.5 basis-auto rounded-sm border border-gray-300 px-1 text-xs"
          value={query}
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="text"
          autoComplete={queryParamsAutoComplete}
          lineWrapping
          multiline={false}
          onChange={handleChangeQuery}
        />
      </div>
      <Select value={method} label="Method" onChange={handleChange('method')} size="xs">
        <option value="get">Get</option>
        <option value="post">Post</option>
      </Select>
      <Input value={accessToken} label="Access Token" onChange={handleChange('accessToken')} size="xs" />
      <Select value={credentials} label="Include Credentials" onChange={handleChange('credentials')} size="xs">
        <option value="include">Include</option>
        <option value="omit">Omit</option>
        <option value="same-origin">Same Origin</option>
      </Select>
      <Switch checked={advancedSettings} size="sm" label="Advanced Settings" onChange={handleChangeEnabled} />
      {advancedSettings && (
        <>
          <KVInput value={Object.entries(headers)} label="Headers" onChange={handleChangeHeaders} size="xs" />
          <div className="flex flex-col">
            <label>When to perform query request</label>
            <QueryBuilder
              direction="vertical"
              className="w-full"
              size="xs"
              query={when}
              onChange={handleChangeWhen}
              showBranches
            />
          </div>
          <Select value={subType} label="Container Tag" onChange={handleChange('subType')} size="xs">
            <option value="div">Div</option>
            <option value="header">Header</option>
            <option value="footer">Footer</option>
            <option value="nav">Nav</option>
            <option value="main">Main</option>
            <option value="section">Section</option>
            <option value="article">Article</option>
            <option value="aside">Aside</option>
            <option value="address">Address</option>
            <option value="figure">Figure</option>
          </Select>
          <div className="my-2 h-px w-full border border-gray-300 bg-gray-300" />
          <div className="flex min-h-50 grow flex-col">
            <label>Mock Data (Build Mode)</label>
            <CodeMirror
              value={mockData}
              theme={theme === 'dark' ? 'dark' : 'light'}
              mode="json"
              lineWrapping
              onChange={handleChangeMockData}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
