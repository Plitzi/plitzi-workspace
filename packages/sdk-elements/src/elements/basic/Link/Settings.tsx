import { get, pick } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useMemo, use, useCallback, useEffect } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { CommonState } from '@plitzi/sdk-shared';

type SettingsProps = {
  mode?: 'page' | 'internal' | 'external';
  href?: string;
  target?: 'blank' | 'self' | 'parent' | 'top';
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ mode = 'page', href = '#', target = 'self', onUpdate }: SettingsProps) => {
  const {
    contexts: { NetworkContext }
  } = usePlitziServiceContext();
  const { useStore } = createStoreHook<CommonState>();
  const [[flat, pageIds, pageFolders]] = useStore(['schema.flat', 'schema.pages', 'schema.pageFolders']);
  const { server } = use(NetworkContext);
  const domain = useMemo(() => get(server, 'domain', 'https://subdomain.plitzi.app'), [server]);
  const pageUrls = useMemo(() => {
    const pages = pick(flat, pageIds);

    return Object.keys(pages).reduce<{ key: string; label: string; defaultPage: boolean }[]>((acum, pageId) => {
      const page = pages[pageId];
      const pageName = get(page, 'attributes.name', pageId);
      const defaultPage = get(page, 'attributes.default', false) as boolean;

      return [...acum, { key: pageId, label: pageName, defaultPage }];
    }, []);
  }, [flat, pageIds]);

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeHref = useCallback((value: string) => onUpdate?.('href', value), [onUpdate]);

  const handleChangeMode = useCallback(
    (newMode: string) => {
      onUpdate?.('mode', newMode);
      if (newMode !== 'page') {
        onUpdate?.('href', '#');

        return;
      }

      const defaultPage = pageUrls.find(pageUrl => pageUrl.defaultPage);
      if (defaultPage) {
        onUpdate?.('href', defaultPage.key);
      }
    },
    [onUpdate, pageUrls]
  );

  useEffect(() => {
    if (mode === 'page' && href === '#') {
      const defaultPage = pageUrls.find(pageUrl => pageUrl.defaultPage);
      if (defaultPage) {
        onUpdate?.('href', defaultPage.key);
      }
    }
  }, [mode, href, pageUrls, onUpdate]);

  const fullpath = useMemo(() => {
    if (mode !== 'page') {
      return href.replaceAll(/[/]+/gim, '/');
    }

    return `${domain}${getPageFullPath(flat, pageFolders, href, true)}`;
  }, [mode, flat, pageFolders, href, domain]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Select value={target} label="Target" onChange={handleChange('target')} size="sm">
        <option value="blank">Blank</option>
        <option value="self">Self</option>
        <option value="parent">Parent</option>
        <option value="top">Top</option>
      </Select>
      <Select value={mode} label="Mode" onChange={handleChangeMode} size="sm">
        <option value="page">Space Page</option>
        <option value="internal">Inside Space</option>
        <option value="external">Outside Space</option>
      </Select>
      {mode !== 'page' && <Input value={href} label="Url" onChange={handleChangeHref} size="sm" />}
      {mode === 'page' && (
        <div className="flex flex-col">
          <Select
            value={href}
            label="Url"
            onChange={handleChangeHref}
            className={{ inputContainer: 'rounded-t' }}
            size="sm"
          >
            <option value="" disabled>
              Select a page
            </option>
            {pageUrls.map(pageUrl => (
              <option key={pageUrl.key} value={pageUrl.key}>
                {pageUrl.label}
              </option>
            ))}
          </Select>
          <div className="truncate rounded-b border-r border-b border-l border-gray-200 p-1 text-xs">{fullpath}</div>
        </div>
      )}
    </div>
  );
};

export default Settings;
