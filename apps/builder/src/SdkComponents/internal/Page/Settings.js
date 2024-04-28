// Packages
import React, { useCallback, use, useMemo } from 'react';
import { usePlitziServiceContext } from '@plitzi/plitzi-sdk';
import noop from 'lodash/noop';
import get from 'lodash/get';
import classNames from 'classnames';
import pick from 'lodash/pick';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Input from '@plitzi/plitzi-ui-components/Input';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';
import Select from '@plitzi/plitzi-ui-components/Select';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Alert from '@plitzi/plitzi-ui-components/Alert';

// Monorepo
import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';

/**
 * @param {{
 *   id?: string;
 *   seoEnabled?: boolean;
 *   enabled?: boolean;
 *   name?: string;
 *   folder?: string;
 *   seoPageTitle?: string;
 *   seoPageDescription?: string;
 *   slug?: string;
 *   layout?: string;
 *   layoutContainer?: string;
 *   accessLevel?: 'public' | 'authenticated' | '';
 *   unauthorizedBehaviour?: '' | 'redirect';
 *   unauthorizedPageRedirect?: string;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const {
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
    onUpdate = noop
  } = props;
  let description = seoPageDescription;
  if (seoPageDescription.length > 160) {
    description = `${seoPageDescription.substr(0, 160)}...`;
  }

  const {
    contexts: { SchemaContext }
  } = usePlitziServiceContext();
  const {
    schema: { flat, pageFolders, pages }
  } = use(SchemaContext);

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
    [flat, pages]
  );

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeName = useCallback(
    e => {
      onUpdate('name', e.target.value);
      const nameAsSlug = name
        .replaceAll(' ', '-')
        .toLowerCase()
        .replaceAll(/([^a-z0-9]+)/gi, '');
      if (!slug || slug === nameAsSlug) {
        onUpdate(
          'slug',
          e.target.value
            .replaceAll(' ', '-')
            .toLowerCase()
            .replaceAll(/([^a-z0-9]+)/gi, '')
        );
      }
    },
    [onUpdate, slug, name]
  );

  const handleChangeSlug = useCallback(
    e => {
      const pattern = /^[a-zA-Z0-9:*/_-]+$/gim;
      if (pattern.test(e.target.value) || !e.target.value) {
        const newSlug = e.target.value.replaceAll('//', '/');
        onUpdate('slug', newSlug);
      }
    },
    [onUpdate]
  );

  const handleChangeLayout = useCallback(
    e => {
      onUpdate('layout', e.target.value);
      onUpdate('layoutContainer', '');
    },
    [onUpdate]
  );

  const handleChangeAccessLevel = useCallback(e => {
    onUpdate('accessLevel', e.target.value);
    onUpdate('unauthorizedBehaviour', '');
    onUpdate('unauthorizedPageRedirect', '');
  }, []);

  const handleChangeSeoEnabled = useCallback(e => onUpdate('seoEnabled', e.target.checked), [onUpdate]);

  const handleChangeEnabled = useCallback(e => onUpdate('enabled', e.target.checked), [onUpdate]);

  const handleChangeFolder = useCallback(option => onUpdate('folder', option?.value ?? ''), [onUpdate]);

  const pageFolderOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...pageFolders.map(({ id, name: folderName }) => ({ value: id, label: folderName }))
    ],
    [pageFolders]
  );

  const fullpath = useMemo(() => getPageFullPath(flat, pageFolders, id, true), [flat, pageFolders, id]);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Page Settings</h1>
      </div>
      <div className="flex flex-col p-4">
        {!enabled && (
          <Alert intent="info" className="text-white">
            <span className="text-xs">When this option is disable, this page wont be accesible</span>
          </Alert>
        )}
        <div className={classNames('flex items-center', { 'mt-4': !enabled })}>
          <Checkbox id="enabled" checked={enabled} onChange={handleChangeEnabled} className="rounded mr-2" />
          <label htmlFor="enabled" className="cursor-pointer select-none">
            Page Enabled
          </label>
        </div>
        <div className="flex flex-col mt-4">
          <label>Page Name</label>
          <Input value={name} onChange={handleChangeName} inputClassName="rounded" />
        </div>
        <Alert intent="info" className="text-white mt-4">
          <span className="text-xs">Slug is a combination of letters, numbers and _ - : / *</span>
        </Alert>
        <div className="flex flex-col mt-4">
          <label>Slug / Path</label>
          <Input value={slug} onChange={handleChangeSlug} inputClassName="rounded-tl rounded-tr" />
          <div className="border-x border-b border-gray-300 text-xs rounded-b px-1 py-0.5 truncate" title={fullpath}>
            Full Path: <span className="font-bold">{fullpath}</span>
          </div>
        </div>
        <div className="flex flex-col mt-4">
          <label>Folder</label>
          <Select2
            value={folder}
            options={pageFolderOptions}
            placeholder="None"
            onChange={handleChangeFolder}
            className="rounded"
          />
        </div>
        <div className="flex flex-col mt-4">
          <label>Layout</label>
          <Select value={layout} placeholder="None" onChange={handleChangeLayout} className="rounded">
            {layouts &&
              layouts.map(({ id, definition: { label } }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
          </Select>
        </div>
        {layout && (
          <div className="flex flex-col mt-4">
            <label>Layout Container Body</label>
            <Select
              value={layoutContainer}
              placeholder="None"
              onChange={handleChange('layoutContainer')}
              className="rounded"
            >
              {layoutContainers &&
                layoutContainers.map(({ id, definition: { label } }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
            </Select>
          </div>
        )}
        <div className="flex flex-col mt-4">
          <label>Restrict Access</label>
          <Select value={accessLevel} onChange={handleChangeAccessLevel} className="rounded" placeholder="None">
            <option value="public">Public</option>
            <option value="authenticated">Authenticated</option>
          </Select>
        </div>
        {accessLevel === '' && (
          <Alert intent="info" className="text-white mt-4">
            <span className="text-xs">Anyone on the internet can access this page</span>
          </Alert>
        )}
        {accessLevel === 'public' && (
          <Alert intent="info" className="text-white mt-4">
            <span className="text-xs">Only Guest can access this page</span>
          </Alert>
        )}
        {accessLevel !== '' && (
          <div className="flex flex-col mt-4">
            <label>Unauthorized Behaviour</label>
            <Select
              value={unauthorizedBehaviour}
              onChange={handleChange('unauthorizedBehaviour')}
              className="rounded"
              placeholder="None"
            >
              <option value="redirect">Redirect</option>
            </Select>
          </div>
        )}
        {unauthorizedBehaviour === 'redirect' && (
          <div className="flex flex-col mt-4">
            <label>Redirect Page</label>
            <Select
              value={unauthorizedPageRedirect}
              onChange={handleChange('unauthorizedPageRedirect')}
              className="rounded"
              placeholder="None"
            >
              {pagesParsed &&
                pagesParsed.map(page => (
                  <option key={page.id} value={page.id}>
                    {get(page, 'attributes.name')}
                  </option>
                ))}
            </Select>
          </div>
        )}
        <div className="flex items-center mt-4">
          <Checkbox id="seo-enabled" checked={seoEnabled} onChange={handleChangeSeoEnabled} className="rounded mr-2" />
          <label htmlFor="seo-enabled" className="cursor-pointer select-none">
            SEO Enabled
          </label>
        </div>
        {seoEnabled && (
          <>
            <div className="flex flex-col mt-4">
              <label>SEO Title</label>
              <Input value={seoPageTitle} onChange={handleChange('seoPageTitle')} inputClassName="rounded" />
            </div>
            <div className="flex flex-col mt-4">
              <label>SEO Description</label>
              <TextArea
                type="text"
                value={seoPageDescription}
                onChange={handleChange('seoPageDescription')}
                rows={3}
                className="rounded"
              />
            </div>
            <div className="mt-4">
              <p className="text-xs mb-4">
                Specify this page&#39;s title and description. You can see how they&#39;ll look in search engine results
                pages (SERPs) in the preview below.
              </p>
              <label>Search Result Preview</label>
              <div className="border border-gray-300 rounded-sm py-1 px-2">
                <div className="mb-1 pt-1 text-[#1a0dab] text-xl">
                  <label>{seoPageTitle}</label>
                </div>
                <div className="text-[#006621] text-sm">
                  <span>www.url.com</span>
                </div>
                <div className="settings-seo__description mb-1 pt-1 text-sm">{description}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;
