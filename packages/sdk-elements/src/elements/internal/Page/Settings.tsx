import Alert from '@plitzi/plitzi-ui/Alert';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import { get, pick } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation';
import { pageAccessOf } from '@plitzi/sdk-shared/schema';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import useSettingsUpdate from '../../useSettingsUpdate';
import LayoutPicker from '../LayoutPicker';

import type { DocumentScroll } from './declaration';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { PageAccess } from '@plitzi/sdk-shared/schema';
import type { ChangeEvent } from 'react';

type SettingsProps = {
  id?: string;
  seoEnabled?: boolean;
  enabled?: boolean;
  name?: string;
  folder?: string;
  seoPageTitle?: string;
  seoPageDescription?: string;
  slug?: string;
  layout?: string;
  layoutContainer?: string;
  accessLevel?: 'public' | 'authenticated' | '';
  unauthorizedBehaviour?: '' | 'redirect';
  unauthorizedPageRedirect?: string;
  documentScroll?: DocumentScroll | '';
  access?: PageAccess | '';
  onUpdate?: (key: string, value: string | boolean | number | PageAccess) => void;
};

const Settings = ({
  id = '',
  seoEnabled = false,
  enabled = true,
  name = '',
  folder = '',
  seoPageTitle = 'Title',
  seoPageDescription = 'Description',
  slug = '',
  layout = '',
  layoutContainer = '',
  accessLevel = '',
  unauthorizedBehaviour = '',
  unauthorizedPageRedirect = '',
  documentScroll = '',
  access = '',
  onUpdate
}: SettingsProps) => {
  const permissions = pageAccessOf({ access })?.permissions.join(', ') ?? '';
  // What is being typed: kept here until the field is left, so a comma typed before the next name is not tidied away.
  const [permissionsDraft, setPermissionsDraft] = useState(permissions);
  useEffect(() => setPermissionsDraft(permissions), [permissions]);
  const [[flat, pages, pageFolders]] = useCommonStore(['schema.flat', 'schema.pages', 'schema.pageFolders']);

  const pagesParsed = useMemo(
    () =>
      Object.values(
        pick(
          flat,
          pages.filter(page => page !== id)
        )
      ),
    [flat, id, pages]
  );

  const update = useSettingsUpdate(onUpdate);

  const handleChangeName = useCallback(
    (value: string) => {
      onUpdate?.('name', value);
      const nameAsSlug = name
        .replaceAll(' ', '-')
        .toLowerCase()
        .replaceAll(/([^a-z0-9]+)/gi, '');
      if (!slug || slug === nameAsSlug) {
        onUpdate?.(
          'slug',
          value
            .replaceAll(' ', '-')
            .toLowerCase()
            .replaceAll(/([^a-z0-9-]+)/gi, '')
        );
      }
    },
    [onUpdate, slug, name]
  );

  const handleChangeSlug = useCallback(
    (value: string) => {
      const pattern = /^[a-zA-Z0-9:*/_-]+$/gim;
      if (pattern.test(value) || !value) {
        const newSlug = value.replaceAll('//', '/');
        onUpdate?.('slug', newSlug);
      }
    },
    [onUpdate]
  );

  const handleChangeAccessLevel = useCallback(
    (value: string) => {
      onUpdate?.('accessLevel', value);
      onUpdate?.('unauthorizedBehaviour', '');
      onUpdate?.('unauthorizedPageRedirect', '');
    },
    [onUpdate]
  );

  // Written as a list a person types — `adminManage, billing` — and kept as the names, or no `access` once it is empty.
  const handleBlurPermissions = useCallback(() => {
    const names = permissionsDraft
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
    onUpdate?.('access', names.length > 0 ? { permissions: names } : '');
  }, [onUpdate, permissionsDraft]);

  const handleChangeSeoEnabled = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('seoEnabled', e.target.checked),
    [onUpdate]
  );

  const handleChangeEnabled = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('enabled', e.target.checked),
    [onUpdate]
  );

  const handleChangeFolder = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onUpdate?.('folder', option?.value ?? ''),
    [onUpdate]
  );

  const pageFolderOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...pageFolders.map(({ id, name: folderName }) => ({ value: id, label: folderName }))
    ],
    [pageFolders]
  );

  const fullpath = useMemo(() => getPageFullPath(flat, pageFolders, id, true), [flat, pageFolders, id]);

  return (
    <div className="flex flex-col gap-4 py-2">
      {!enabled && (
        <Alert intent="info" size="xs" solid={false}>
          <span className="text-xs">When this option is disable, this page wont be accesible</span>
        </Alert>
      )}
      <Checkbox label=" Page Enabled" checked={enabled} onChange={handleChangeEnabled} size="xs" />
      <Input value={name} label="Page Name" onChange={handleChangeName} size="xs" />
      <Alert intent="info" size="xs" solid={false}>
        <span className="text-xs">Slug is a combination of letters, numbers and _ - : / *</span>
      </Alert>
      <div className="flex flex-col">
        <Input
          value={slug}
          onChange={handleChangeSlug}
          label="Slug / Path"
          className={{ inputContainer: 'rounded-none rounded-tl rounded-tr' }}
          size="xs"
        />
        <div className="truncate rounded-b border-x border-b border-gray-200 px-1 py-0.5 text-xs" title={fullpath}>
          Full Path: <span className="font-bold">{fullpath}</span>
        </div>
      </div>
      <Select2
        label="Folder"
        value={folder}
        options={pageFolderOptions}
        placeholder="None"
        onChange={handleChangeFolder}
        size="xs"
      />
      <LayoutPicker layout={layout} layoutContainer={layoutContainer} onUpdate={onUpdate} />
      <Select
        value={accessLevel}
        label="Restrict Access"
        onChange={handleChangeAccessLevel}
        placeholder="None"
        size="xs"
      >
        <option value="public">Public</option>
        <option value="authenticated">Authenticated</option>
      </Select>
      {accessLevel === '' && (
        <Alert intent="info" solid={false} size="xs">
          <span className="text-xs">Anyone on the internet can access this page</span>
        </Alert>
      )}
      {accessLevel === 'public' && (
        <Alert intent="info" solid={false} size="xs">
          <span className="text-xs">Only Guest can access this page</span>
        </Alert>
      )}
      <Input
        label="Required permissions"
        value={permissionsDraft}
        onChange={setPermissionsDraft}
        onBlur={handleBlurPermissions}
        placeholder="None — anybody this page is for"
        size="xs"
      />
      {permissions !== '' && (
        <Alert intent="info" solid={false} size="xs">
          <span className="text-xs">
            Only visitors holding every one of these see this page. Anybody else is answered 401 or 403, and the server
            never sends them its content
          </span>
        </Alert>
      )}
      {(accessLevel !== '' || permissions !== '') && (
        <Select
          label="Unauthorized Behaviour"
          value={unauthorizedBehaviour}
          onChange={update.text('unauthorizedBehaviour')}
          placeholder="None"
          size="xs"
        >
          <option value="redirect">Redirect</option>
        </Select>
      )}
      {unauthorizedBehaviour === 'redirect' && (
        <Select
          value={unauthorizedPageRedirect}
          label="Redirect Page"
          onChange={update.text('unauthorizedPageRedirect')}
          placeholder="None"
          size="xs"
        >
          {pagesParsed.map(page => (
            <option key={page.id} value={page.id}>
              {get(page, 'attributes.name') as string}
            </option>
          ))}
        </Select>
      )}
      <Select
        value={documentScroll}
        label="Document Scroll"
        onChange={update.text('documentScroll')}
        placeholder="Scrolls"
        size="xs"
      >
        <option value="noBounce">No bounce</option>
        <option value="locked">Locked</option>
      </Select>
      {documentScroll === 'noBounce' && (
        <Alert intent="info" solid={false} size="xs">
          <span className="text-xs">
            The page scrolls, but a finger pulled past either end no longer bounces it or reloads it
          </span>
        </Alert>
      )}
      {documentScroll === 'locked' && (
        <Alert intent="info" solid={false} size="xs">
          <span className="text-xs">
            The page holds still: only the parts set to scroll on their own (overflow auto) move. For a screen that
            fills the window — a dashboard, a board
          </span>
        </Alert>
      )}
      <Checkbox label=" SEO Enabled" checked={seoEnabled} onChange={handleChangeSeoEnabled} size="xs" />
      {seoEnabled && (
        <>
          <Input value={seoPageTitle} label="SEO Title" onChange={update.text('seoPageTitle')} size="xs" />
          <TextArea
            label="SEO Description"
            value={seoPageDescription}
            onChange={update.text('seoPageDescription')}
            rows={3}
            size="xs"
          />
          <div className="flex flex-col">
            <p className="mb-4 text-xs">
              Specify this page&#39;s title and description. You can see how they&#39;ll look in search engine results
              pages (SERPs) in the preview below.
            </p>
            <label>Search Result Preview</label>
            <div className="rounded border border-gray-300 px-2 py-1">
              <div className="mb-1 pt-1 text-xl text-[#1a0dab]">
                <label>{seoPageTitle}</label>
              </div>
              <div className="text-sm text-[#006621]">
                <span>www.url.com</span>
              </div>
              <div className="settings-seo__description mb-1 pt-1 text-sm">{`${seoPageDescription.slice(0, 160)}...`}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
