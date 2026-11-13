import Alert from '@plitzi/plitzi-ui/Alert';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import { get, pick } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation';
import { NOT_FOUND_SLUG, notFoundPageIn } from '@plitzi/sdk-shared/navigation';
import { OG_TYPES, pageAccessOf } from '@plitzi/sdk-shared/schema';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import SettingsSection from '../../../components/SettingsSection';
import useSettingsUpdate from '../../useSettingsUpdate';
import LayoutPicker from '../LayoutPicker';
import { accessHelp, accessSummary, isRestricted, scrollOf, seoSummary } from './settingsSummary';
import SharePreview from './SharePreview';

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
  seoRobots?: string;
  seoImage?: string;
  seoImageAlt?: string;
  seoType?: string;
  slug?: string;
  layout?: string;
  layoutContainer?: string;
  accessLevel?: 'public' | 'authenticated' | '';
  unauthorizedBehaviour?: '' | 'redirect' | 'notFound';
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
  seoRobots = '',
  seoImage = '',
  seoImageAlt = '',
  seoType = '',
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

  /**
   * Why the last change that would have made a second 404 page in one place was not made: one per place — the space, or
   * one folder —, or the router would pick one of two. Said beside the field it was typed in.
   */
  const [notFoundRefusal, setNotFoundRefusal] = useState('');
  const notFoundAlready = useCallback(
    (inFolder: string): string | undefined => {
      const other = notFoundPageIn({ flat, pages }, inFolder, id);
      const name: unknown = other !== undefined && Object.hasOwn(flat, other) ? flat[other].attributes.name : undefined;

      return other === undefined ? undefined : typeof name === 'string' && name !== '' ? name : other;
    },
    [flat, pages, id]
  );

  const handleChangeSlug = useCallback(
    (value: string) => {
      const pattern = /^[a-zA-Z0-9:*/_-]+$/gim;
      if (pattern.test(value) || !value) {
        const newSlug = value.replaceAll('//', '/');
        const other = newSlug === NOT_FOUND_SLUG ? notFoundAlready(folder) : undefined;
        if (other !== undefined) {
          setNotFoundRefusal(
            `"${other}" is already the 404 page ${folder ? 'of this folder' : 'of the space'}: one per place. Use "Use as 404 page" in the Pages panel to make this one it instead.`
          );

          return;
        }

        setNotFoundRefusal('');
        onUpdate?.('slug', newSlug);
      }
    },
    [onUpdate, notFoundAlready, folder]
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
    (option?: Exclude<Option, OptionGroup>) => {
      const into = option?.value ?? '';
      const other = slug === NOT_FOUND_SLUG ? notFoundAlready(into) : undefined;
      if (other !== undefined) {
        setNotFoundRefusal(
          `"${other}" is already the 404 page ${into ? 'of that folder' : 'of the space'}: one per place. Give one of them another slug first.`
        );

        return;
      }

      setNotFoundRefusal('');
      onUpdate?.('folder', into);
    },
    [onUpdate, notFoundAlready, slug]
  );

  const pageFolderOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...pageFolders.map(({ id, name: folderName }) => ({ value: id, label: folderName }))
    ],
    [pageFolders]
  );

  const fullpath = useMemo(() => getPageFullPath(flat, pageFolders, id, true), [flat, pageFolders, id]);

  const accessState = useMemo(() => {
    const redirectName: unknown = Object.hasOwn(flat, unauthorizedPageRedirect)
      ? flat[unauthorizedPageRedirect].attributes.name
      : undefined;

    return {
      accessLevel,
      permissions: pageAccessOf({ access })?.permissions ?? [],
      unauthorizedBehaviour,
      redirectName: typeof redirectName === 'string' ? redirectName : ''
    };
  }, [accessLevel, access, unauthorizedBehaviour, flat, unauthorizedPageRedirect]);
  const scroll = scrollOf(documentScroll);

  return (
    <div className="flex flex-col py-2">
      <SettingsSection
        id="page-page"
        title="Page"
        summary={[slug === NOT_FOUND_SLUG ? '404 page' : fullpath, enabled ? '' : 'disabled']
          .filter(Boolean)
          .join(' · ')}
        defaultOpen
      >
        <Checkbox label=" Page Enabled" checked={enabled} onChange={handleChangeEnabled} size="xs" />
        {!enabled && (
          <Alert intent="info" size="xs" solid={false}>
            <span className="text-xs">While disabled, this page is not served to anybody</span>
          </Alert>
        )}
        <Input value={name} label="Page Name" onChange={handleChangeName} size="xs" />
        <div className="flex flex-col gap-1">
          <Input value={slug} onChange={handleChangeSlug} label="Slug / Path" size="xs" />
          <span className="text-ui-fg-subtle truncate text-xs" title={fullpath}>
            Full path: <span className="text-ui-fg font-semibold">{fullpath}</span>
          </span>
          <span className="text-ui-fg-subtle text-xs">Letters, numbers and _ - : / *</span>
          {slug === NOT_FOUND_SLUG && (
            <span className="text-ui-fg-subtle text-xs">
              The 404 page {folder ? 'of its folder' : 'of the space'}: every address{folder ? ' in it' : ''} no other
              page answers lands here, sent with status 404.
            </span>
          )}
          {notFoundRefusal && (
            <Alert intent="warning" size="xs" solid={false}>
              <span className="text-xs">{notFoundRefusal}</span>
            </Alert>
          )}
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
      </SettingsSection>
      <SettingsSection
        id="page-access"
        title="Access"
        summary={accessSummary(accessState)}
        highlight={isRestricted(accessState)}
      >
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
        <Input
          label="Required permissions"
          value={permissionsDraft}
          onChange={setPermissionsDraft}
          onBlur={handleBlurPermissions}
          placeholder="None — anybody this page is for"
          size="xs"
        />
        {(accessLevel !== '' || permissions !== '') && (
          <Select
            label="Unauthorized Behaviour"
            value={unauthorizedBehaviour}
            onChange={update.text('unauthorizedBehaviour')}
            placeholder="None"
            size="xs"
          >
            <option value="redirect">Redirect</option>
            <option value="notFound">Not found (404)</option>
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
        <span className="text-ui-fg-subtle text-xs">{accessHelp(accessState)}</span>
      </SettingsSection>
      <SettingsSection id="page-scroll" title="Scroll" summary={scroll.label}>
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
        <span className="text-ui-fg-subtle text-xs">{scroll.help}</span>
      </SettingsSection>
      <SettingsSection
        id="page-seo"
        title="Search & sharing"
        summary={seoSummary(seoEnabled, seoPageTitle)}
        highlight={seoEnabled}
      >
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
            <Input
              value={seoRobots}
              label="Robots"
              placeholder="index, follow"
              onChange={update.text('seoRobots')}
              size="xs"
            />
            <Select
              value={seoType}
              label="Kind of page"
              onChange={update.text('seoType')}
              size="xs"
              placeholder="website"
            >
              {OG_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              value={seoImage}
              label="Share image"
              placeholder="/og.png, https://…, or {{ apiContainer_room.cover }}"
              onChange={update.text('seoImage')}
              size="xs"
            />
            <Input
              value={seoImageAlt}
              label="Share image description"
              placeholder="What the picture shows"
              onChange={update.text('seoImageAlt')}
              size="xs"
            />
            <SettingsSection id="page-seo-previews" title="Previews" summary="Search result and share card">
              <span className="text-ui-fg-subtle text-xs">
                How this page&#39;s title and description show in search results (SERPs):
              </span>
              <div className="border-ui-line-strong bg-ui-panel rounded border px-2 py-1">
                <div className="mb-1 pt-1 text-xl text-[#1a0dab]">
                  <label>{seoPageTitle}</label>
                </div>
                <div className="text-sm text-[#006621]">
                  <span>www.url.com</span>
                </div>
                <div className="settings-seo__description text-ui-fg mb-1 pt-1 text-sm">
                  {`${seoPageDescription.slice(0, 160)}...`}
                </div>
              </div>
              <SharePreview
                title={seoPageTitle}
                description={seoPageDescription}
                {...(seoImage ? { image: seoImage } : {})}
                {...(seoImageAlt ? { imageAlt: seoImageAlt } : {})}
              />
            </SettingsSection>
          </>
        )}
      </SettingsSection>
    </div>
  );
};

export default Settings;
