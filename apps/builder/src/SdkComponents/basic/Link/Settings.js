// Packages
import React, { useMemo, useContext, useCallback, useEffect } from 'react';
import { usePlitziServiceContext } from '@plitzi/plitzi-sdk';
import noop from 'lodash/noop';
import get from 'lodash/get';
import pick from 'lodash/pick';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select from '@plitzi/plitzi-ui-components/Select';

// Monorepo
import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';

/**
 * @param {{
 *   mode?: 'page' | 'internal' | 'external';
 *   href?: string;
 *   target?: 'blank' | 'self' | 'parent' | 'top';
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { mode = 'page', href = '#', target = 'self', onUpdate = noop } = props;
  const {
    contexts: { NetworkContext, SchemaContext }
  } = usePlitziServiceContext();
  const {
    schema: { pages: pageIds, flat, pageFolders }
  } = useContext(SchemaContext);
  const { server } = useContext(NetworkContext);
  const domain = useMemo(() => get(server, 'domain', 'https://subdomain.plitzi.app'), [server]);
  const pageUrls = useMemo(() => {
    const pages = pick(flat, pageIds);

    return Object.keys(pages).reduce((acum, pageId) => {
      const page = pages[pageId];
      const pageName = get(page, 'attributes.name', pageId);
      const defaultPage = get(page, 'attributes.default', false);

      return [...acum, { key: pageId, label: pageName, defaultPage }];
    }, []);
  }, [flat]);

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeHref = useCallback(e => onUpdate('href', e.target.value), [onUpdate]);

  const handleChangeMode = useCallback(
    e => {
      const newMode = e.target.value;
      onUpdate('mode', newMode);
      if (newMode !== 'page') {
        onUpdate('href', '#');
      } else if (newMode === 'page') {
        const defaultPage = pageUrls.find(pageUrl => pageUrl.defaultPage);
        if (defaultPage) {
          onUpdate('href', defaultPage.key);
        }
      }
    },
    [onUpdate, pageUrls]
  );

  useEffect(() => {
    if (mode === 'page' && href === '#') {
      const defaultPage = pageUrls.find(pageUrl => pageUrl.defaultPage);
      if (defaultPage) {
        onUpdate('href', defaultPage.key);
      }
    }
  }, [mode, href]);

  const fullpath = useMemo(() => {
    if (mode !== 'page') {
      return href.replaceAll(/[/]+/gim, '/');
    }

    return `${domain}${getPageFullPath(flat, pageFolders, href, true)}`;
  }, [mode, flat, pageFolders, href, domain]);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Link Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Target</label>
          <Select value={target} onChange={handleChange('target')} className="rounded">
            <option value="blank">Blank</option>
            <option value="self">Self</option>
            <option value="parent">Parent</option>
            <option value="top">Top</option>
          </Select>
        </div>
        <div className="flex flex-col mt-4">
          <label>Mode</label>
          <Select value={mode} onChange={handleChangeMode} className="rounded">
            <option value="page">Space Page</option>
            <option value="internal">Inside Space</option>
            <option value="external">Outside Space</option>
          </Select>
        </div>
        <div className="flex flex-col mt-4">
          <label>Url</label>
          {mode !== 'page' && <Input value={href} onChange={handleChangeHref} inputClassName="rounded" />}
          {mode === 'page' && (
            <>
              <Select value={href} onChange={handleChangeHref} className="rounded-t">
                <option value="" disabled>
                  Select a page
                </option>
                {pageUrls &&
                  pageUrls.map(pageUrl => (
                    <option key={pageUrl.key} value={pageUrl.key}>
                      {pageUrl.label}
                    </option>
                  ))}
              </Select>
              <div className="text-xs truncate border-b border-l border-r border-gray-300 p-1 rounded-b">
                {fullpath}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
