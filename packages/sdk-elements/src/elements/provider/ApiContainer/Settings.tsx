import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import Select from '@plitzi/plitzi-ui/Select';
import Switch from '@plitzi/plitzi-ui/Switch';
import { useCallback, useMemo, useState } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { useSdkStore } from '@plitzi/sdk-shared/store';
import { useBuilderStore, useCommonStore } from '@plitzi/sdk-shared/store';
import useTheme from '@plitzi/sdk-shared/theme/useTheme';

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
  action?: string;
  endpoint?: string;
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
  action = '',
  endpoint = '',
  resource = '',
  limit = '10',
  singleRecord = false,
  filters = emptyFilters,
  pagination = 'none',
  pageParam = 'page',
  renderWhileLoading = false,
  onUpdate
}: SettingsProps) => {
  const { resolvedTheme } = useTheme();
  const [pageDefinitions] = useBuilderStore('pageDefinitions');
  const [connectors] = useBuilderStore('connectors');
  const [actionCatalog] = useCommonStore('actions.catalog');
  const [hasServerRendering] = useBuilderStore('hasServerRendering');
  const [advancedSettings, setAdvancedSettings] = useState(false);
  const serverMode = runtime === 'server';
  // What the element already says, read back for the picker. A server element that names neither yet is being set
  // up as a connector, which is the common case and the one the panel opened on before actions existed.
  const source = !serverMode ? 'client' : action && !connector ? 'action' : 'connector';
  const [[routeParams, queryParams, currentPageId]] = useSdkStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.currentPageId'
  ]);

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

  /**
   * Where this provider's data comes from — and the two server answers are mutually exclusive.
   *
   * An element names ONE producer. The server checks the connector first, so an element carrying both would keep
   * resolving through the connector however the panel was set: clearing the other one is what makes the choice
   * mean what it says.
   */
  const handleChangeSource = useCallback(
    (value: string) => {
      if (value === 'client') {
        onUpdate?.('runtime', 'client', true);

        return;
      }

      onUpdate?.('runtime', 'server', true);
      onUpdate?.(value === 'action' ? 'connector' : 'action', '');
    },
    [onUpdate]
  );

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

  const manifest = useMemo(
    () => connectorOptions.find(item => item.identifier === connector)?.manifest,
    [connectorOptions, connector]
  );

  // Operators come from the selected manifest, so the filter rows only ever offer comparisons this provider can
  // actually execute.
  const operators = useMemo(() => Object.keys(manifest?.operators ?? {}), [manifest]);

  // Likewise the endpoints: a connector declares which reads it supports, and offering anything else would author
  // an element that resolves to an error.
  const readEndpoints = useMemo(() => Object.keys(manifest?.endpoints.read ?? {}), [manifest]);

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
      <Select value={source} label="Data Source" onChange={handleChangeSource} size="xs">
        <option value="client">Browser request</option>
        <option value="connector">Connector (server-side)</option>
        <option value="action">Server action (server-side)</option>
      </Select>
      <span className="text-xs text-gray-500 dark:text-zinc-400">
        {source === 'connector' &&
          'The server calls the API and hands the page its records. The endpoint and the credential never reach the browser, and the content is in the HTML search engines see.'}
        {source === 'action' &&
          'A flow runs on the server and hands the page whatever its output step returns — for the read a connector cannot express: two calls joined, a computed field, a shape that depends on who is looking. It is fed this page’s route and query params.'}
        {source === 'client' &&
          'The browser calls the URL directly. Anything it needs to authenticate with is visible to the visitor, and the content is not in the initial HTML.'}
      </span>
      {source === 'action' && (
        <>
          {actionCatalog?.length === 0 && (
            <div className="rounded-sm border border-gray-300 p-2 text-xs text-gray-500 dark:border-zinc-600 dark:text-zinc-400">
              No actions yet. Add one in the Actions panel and give it a “While a page renders” trigger — that is the
              way in this element uses.
            </div>
          )}
          <Select value={action} label="Action" onChange={handleChange('action')} size="xs">
            <option value="">Select an action…</option>
            {(actionCatalog ?? []).map(item => (
              <option key={item.identifier} value={item.identifier}>
                {item.name}
              </option>
            ))}
          </Select>
        </>
      )}
      {serverMode && !hasServerRendering && (
        <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          This space has no server-rendered deployment. It resolves here in the builder, but a published page would have
          no server to resolve it — publish with a Plitzi SSR credential, or read the API from the browser instead.
        </div>
      )}
      {source === 'connector' && (
        <>
          {connectorOptions.length === 0 && (
            <div className="rounded-sm border border-gray-300 p-2 text-xs text-gray-500 dark:border-zinc-600 dark:text-zinc-400">
              No connectors yet. Add one in the Connectors panel — it holds the API endpoints, and the credential stays
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
          {readEndpoints.length > 1 && (
            <Select value={endpoint} label="Endpoint" onChange={handleChange('endpoint')} size="xs">
              {readEndpoints.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          )}
          <Input
            value={resource}
            label="Resource"
            placeholder="posts"
            title="The collection read through the connector — what {{resource}} becomes in the endpoint path."
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
              theme={resolvedTheme}
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
              theme={resolvedTheme}
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
