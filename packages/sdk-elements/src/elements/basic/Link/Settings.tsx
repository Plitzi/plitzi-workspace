import { get, pick } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useMemo, use, useCallback, useEffect } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import IconField from '../../../components/IconField';
import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  mode?: 'page' | 'internal' | 'external';
  href?: string;
  hash?: string;
  target?: 'blank' | 'self' | 'parent' | 'top';
  label?: string;
  content?: string;
  contentPlacement?: 'before' | 'after';
  icon?: string;
  iconPlacement?: 'before' | 'after';
  current?: 'page' | 'section';
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  mode = 'page',
  href = '#',
  hash = '',
  target = 'self',
  label = '',
  content = '',
  contentPlacement = 'after',
  icon = '',
  iconPlacement = 'before',
  current = 'page',
  onUpdate
}: SettingsProps) => {
  const [[flat, pageIds, pageFolders]] = useCommonStore(['schema.flat', 'schema.pages', 'schema.pageFolders']);
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

  const update = useSettingsUpdate(onUpdate);

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
      <Input
        value={content}
        label="Content"
        placeholder="The link's words, without a text inside it"
        onChange={update.text('content')}
        size="sm"
      />
      <Select value={contentPlacement} label="Content Placement" onChange={update.text('contentPlacement')} size="sm">
        <option value="before">Before Elements</option>
        <option value="after">After Elements</option>
      </Select>
      <Select value={target} label="Target" onChange={update.text('target')} size="sm">
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
      {mode !== 'external' && (
        <Select value={current} label="Current On" onChange={update.text('current')} size="sm">
          <option value="page">Its Page</option>
          <option value="section">Its Page And The Pages Under It</option>
        </Select>
      )}
      {mode !== 'external' && (
        <Input
          value={hash}
          label="Section"
          placeholder="An element's anchor, without the #"
          onChange={update.text('hash')}
          size="sm"
        />
      )}
      <Input
        value={label}
        label="Accessible Name"
        placeholder="For a link that wraps a whole card"
        onChange={update.text('label')}
        size="sm"
      />
      <IconField icon={icon} iconPlacement={iconPlacement} onUpdate={onUpdate} />
    </div>
  );
};

export default Settings;
