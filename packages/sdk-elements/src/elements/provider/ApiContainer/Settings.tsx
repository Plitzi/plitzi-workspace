import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import Select from '@plitzi/plitzi-ui/Select';
import Switch from '@plitzi/plitzi-ui/Switch';
import { useCallback, use, useMemo, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import FiltersInput from './components/FiltersInput';

import type { ConnectorFilterValue } from './components/FiltersInput';
import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { ElementRuntime } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

const emptyFilters: ConnectorFilterValue[] = [];

type SettingsProps = {
  query?: string;
  method?: 'get' | 'post';
  accessToken?: string;
  headers?: object;
  when?: RuleGroup;
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
  mockData?: string;
  credentials?: RequestCredentials;
  runtime?: ElementRuntime;
  connector?: string;
  resource?: string;
  limit?: string;
  singleRecord?: boolean;
  filters?: ConnectorFilterValue[];
  pagination?: 'none' | 'url' | 'append';
  pageParam?: string;
  renderWhileLoading?: boolean;
  onUpdate?: (key: string, value: string | boolean | number | object, isDefinition?: boolean) => void;
};

const Settings = ({
  query = '',
  method = 'get',
  accessToken = '',
  headers = emptyObject,
  when,
  subType = 'div',
  mockData = '{}',
  credentials = 'same-origin',
  runtime = 'client',
  connector = '',
  resource = '',
  limit = '10',
  singleRecord = false,
  filters = emptyFilters,
  pagination = 'none',
  pageParam = 'page',
  renderWhileLoading = false,
  onUpdate
}: SettingsProps) => {
  const { theme } = use(ThemeContext);
  const [pageDefinitions] = useBuilderStore('pageDefinitions');
  const [connectors] = useBuilderStore('connectors');
  const [hasServerRendering] = useBuilderStore('hasServerRendering');
  const [advancedSettings, setAdvancedSettings] = useState(false);
  const { routeParams, queryParams, currentPageId } = use(NavigationContext);
  const serverMode = runtime === 'server';

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

  const handleChangeRuntime = useCallback((value: string) => onUpdate?.('runtime', value, true), [onUpdate]);

  const handleChangeSingleRecord = useCallback(
    (e: ChangeEvent) => onUpdate?.('singleRecord', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeRenderWhileLoading = useCallback(
    (e: ChangeEvent) => onUpdate?.('renderWhileLoading', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeFilters = useCallback((value: ConnectorFilterValue[]) => onUpdate?.('filters', value), [onUpdate]);

  const connectorOptions = useMemo(() => Object.values(connectors), [connectors]);

  // Operators come from the selected manifest, so the filter rows only ever offer comparisons this provider can
  // actually execute.
  const operators = useMemo(() => {
    const manifest = connectorOptions.find(item => item.identifier === connector)?.manifest;
    const declared = manifest?.operators;

    return declared && typeof declared === 'object' ? Object.keys(declared) : [];
  }, [connectorOptions, connector]);

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
      <Select value={runtime} label="Data Source" onChange={handleChangeRuntime} size="xs">
        <option value="client">Browser request</option>
        <option value="server">Connector (server-side)</option>
      </Select>
      <span className="text-xs text-gray-500 dark:text-zinc-400">
        {serverMode
          ? 'The server reads the CMS and hands the page its records. The endpoint and the credential never reach the browser, and the content is in the HTML search engines see.'
          : 'The browser calls the URL directly. Anything it needs to authenticate with is visible to the visitor, and the content is not in the initial HTML.'}
      </span>
      {serverMode && (
        <>
          {!hasServerRendering && (
            <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
              This space has no server-rendered deployment. Connectors resolve here in the builder, but a published page
              would have no server to resolve them — publish with a Plitzi SSR credential, or read the API from the
              browser instead.
            </div>
          )}
          {connectorOptions.length === 0 && (
            <div className="rounded-sm border border-gray-300 p-2 text-xs text-gray-500 dark:border-zinc-600 dark:text-zinc-400">
              No connectors yet. Add one in the Connectors panel — it holds the CMS endpoints, and the credential stays
              on the server.
            </div>
          )}
          <Select value={connector} label="Connector" onChange={handleChange('connector')} size="xs">
            <option value="">Select a connector…</option>
            {connectorOptions.map(item => (
              <option key={item.identifier} value={item.identifier}>
                {item.name}
              </option>
            ))}
          </Select>
          <Input
            value={resource}
            label="Resource"
            placeholder="posts"
            title="The content type read through the connector."
            onChange={handleChange('resource')}
            size="xs"
          />
          <FiltersInput value={filters} operators={operators} onChange={handleChangeFilters} />
          <Switch
            checked={singleRecord}
            size="sm"
            label="Single record (detail page)"
            onChange={handleChangeSingleRecord}
          />
          {!singleRecord && (
            <>
              <Input value={limit} label="Records per page" onChange={handleChange('limit')} size="xs" />
              <Select value={pagination} label="Pagination" onChange={handleChange('pagination')} size="xs">
                <option value="none">None</option>
                <option value="url">URL (indexable)</option>
                <option value="append">Load more</option>
              </Select>
              {pagination !== 'none' && (
                <Input
                  value={pageParam}
                  label="Page parameter"
                  title="Query-string key this list pages on. Give each list its own so they page independently."
                  onChange={handleChange('pageParam')}
                  size="xs"
                />
              )}
            </>
          )}
        </>
      )}
      {!serverMode && (
        <>
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
          <Input
            value={accessToken}
            label="Access Token"
            title="Bind this to the signed-in visitor's token. A value typed here is saved in the page and served to
              every visitor — put anything secret behind a connector instead."
            onChange={handleChange('accessToken')}
            size="xs"
          />
          <Select value={credentials} label="Include Credentials" onChange={handleChange('credentials')} size="xs">
            <option value="include">Include</option>
            <option value="omit">Omit</option>
            <option value="same-origin">Same Origin</option>
          </Select>
          <Switch
            checked={renderWhileLoading}
            size="sm"
            label="Render children while loading"
            onChange={handleChangeRenderWhileLoading}
          />
        </>
      )}
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
