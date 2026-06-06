import Alert from '@plitzi/plitzi-ui/Alert';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import { get, pick } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import { createStoreHook } from '@plitzi/nexus/createStore';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { CommonState } from '@plitzi/sdk-shared';
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
  onUpdate?: (key: string, value: string | boolean | number) => void;
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
  onUpdate
}: SettingsProps) => {
  const { useStore } = createStoreHook<CommonState>();
  const [[flat, pages, pageFolders]] = useStore(['schema.flat', 'schema.pages', 'schema.pageFolders']);

  const layouts = useMemo(
    () => Object.values(flat).filter(element => get(element, 'definition.type', '') === 'layoutContainer'),
    [flat]
  );

  const layoutContainers = useMemo(() => {
    if (!layout) {
      return [];
    }

    return Object.values(flat).filter(
      element => get(element, 'definition.type', '') === 'container' && get(element, 'definition.rootId', '') === layout
    );
  }, [flat, layout]);

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

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

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

  const handleChangeLayout = useCallback(
    (value: string) => {
      onUpdate?.('layout', value);
      onUpdate?.('layoutContainer', '');
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

  const handleChangeSeoEnabled = useCallback(
    (e: ChangeEvent) => onUpdate?.('seoEnabled', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeEnabled = useCallback(
    (e: ChangeEvent) => onUpdate?.('enabled', (e.target as HTMLInputElement).checked),
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
      <Select value={layout} placeholder="None" label="Layout" onChange={handleChangeLayout} size="xs">
        {layouts.map(({ id, definition: { label } }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      {layout && (
        <Select
          value={layoutContainer}
          placeholder="None"
          label="Layout Container Body"
          onChange={handleChange('layoutContainer')}
          size="xs"
        >
          {layoutContainers.map(({ id, definition: { label } }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      )}
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
      {accessLevel !== '' && (
        <Select
          label="Unauthorized Behaviour"
          value={unauthorizedBehaviour}
          onChange={handleChange('unauthorizedBehaviour')}
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
          onChange={handleChange('unauthorizedPageRedirect')}
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
      <Checkbox label=" SEO Enabled" checked={seoEnabled} onChange={handleChangeSeoEnabled} size="xs" />
      {seoEnabled && (
        <>
          <Input value={seoPageTitle} label="SEO Title" onChange={handleChange('seoPageTitle')} size="xs" />
          <TextArea
            label="SEO Description"
            value={seoPageDescription}
            onChange={handleChange('seoPageDescription')}
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
