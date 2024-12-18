// Packages
import React, { useCallback, use, useMemo, useState } from 'react';
import get from 'lodash/get';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui-components/Select';
import Input from '@plitzi/plitzi-ui-components/Input';
import CodeMirror, { CODEMIRROR_TOKEN } from '@plitzi/plitzi-ui/CodeMirror';
import QueryBuilder from '@plitzi/plitzi-ui-components/QueryBuilder';
import Switch from '@plitzi/plitzi-ui-components/Switch';
import KVEditor from '@plitzi/plitzi-ui-components/KVEditor';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

/**
 * @param {{
 *   query?: string;
 *   method?: 'get' | 'post';
 *   accessToken?: string;
 *   when?: object;
 *   headers?: object;
 *   subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
 *   mockData?: string;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const {
    query = '',
    method = 'get',
    accessToken = '',
    when = emptyObject,
    headers = emptyObject,
    subType = 'div',
    mockData = '{}',
    onUpdate = noop
  } = props;
  const { pageDefinitions } = use(SchemaMainContext);
  const [advancedSettings, setAdvancedSettings] = useState(false);
  const { routeParams, queryParams, currentPageId } = use(NavigationContext);

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeQuery = useCallback(value => onUpdate('query', value), [onUpdate]);

  const handleChangeWhen = useCallback(whenQuery => onUpdate('when', whenQuery), [onUpdate]);

  const handleChangeMockData = useCallback(value => onUpdate('mockData', value), [onUpdate]);

  const handleChangeEnabled = useCallback(e => setAdvancedSettings(e.target.checked), []);

  const handleChangeHeaders = useCallback((value, valueObj) => onUpdate('headers', valueObj), [onUpdate]);

  const urlParams = useMemo(() => {
    const slug = get(pageDefinitions, `${currentPageId}.attributes.slug`, '');

    return [...slug.matchAll(/:[a-z0-9_-]+/gim)].map(match => match[0].slice(1));
  }, [pageDefinitions, currentPageId]);

  const queryParamsAutoComplete = useMemo(
    () =>
      [...Object.keys(routeParams), ...Object.keys(queryParams), ...urlParams].map(token => ({
        key: CODEMIRROR_TOKEN,
        value: token
      })),
    [routeParams, queryParams, urlParams]
  );

  return (
    <div className="flex flex-col grow">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Api Container Settings</h1>
      </div>
      <div className="flex flex-col grow p-2 gap-2">
        <div className="flex flex-col">
          <label>Query</label>
          <CodeMirror
            className="basis-auto border border-gray-300 rounded font-rubik text-sm px-3 py-1 min-h-[38px]"
            value={query}
            theme="light"
            mode="text"
            autoComplete={queryParamsAutoComplete}
            lineWrapping
            multiline={false}
            onChange={handleChangeQuery}
          />
        </div>
        <div className="flex flex-col">
          <label>Method</label>
          <Select value={method} onChange={handleChange('method')} className="rounded">
            <option value="get">Get</option>
            <option value="post">Post</option>
          </Select>
        </div>
        <div className="flex flex-col">
          <label>Access Token</label>
          <Input value={accessToken} onChange={handleChange('accessToken')} inputClassName="rounded" />
        </div>
        <div className="flex gap-1">
          <Switch value={advancedSettings} size="sm" className="!w-auto" onChange={handleChangeEnabled}>
            Advanced Settings
          </Switch>
        </div>
        {advancedSettings && (
          <>
            <div className="flex flex-col">
              <label>Headers</label>
              <KVEditor
                className="rounded"
                classNameItem="not-first:rounded-t-none rounded-t last:rounded-b"
                classNameInput="rounded"
                value={Object.entries(headers)}
                onChange={handleChangeHeaders}
              />
            </div>
            <div>
              <label>When to perform query request</label>
              <QueryBuilder
                ruleDirection="vertical"
                className="w-full"
                query={when}
                onChange={handleChangeWhen}
                showBranches
              />
            </div>
            <div className="flex flex-col">
              <label>Container Tag</label>
              <Select value={subType} onChange={handleChange('subType')} className="rounded">
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
            </div>
            <div className="h-[1px] w-full border border-gray-300 bg-gray-300 my-2" />
            <div className="flex flex-col grow min-h-[200px]">
              <label>Mock Data (Build Mode)</label>
              <CodeMirror value={mockData} theme="light" mode="json" lineWrapping onChange={handleChangeMockData} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;
