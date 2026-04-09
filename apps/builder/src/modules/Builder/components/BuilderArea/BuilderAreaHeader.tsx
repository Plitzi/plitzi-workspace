import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import { get } from '@plitzi/plitzi-ui/helpers';
import Icon from '@plitzi/plitzi-ui/Icon';
import PageOverview from '@plitzi/plitzi-ui/icons/PageOverview';
import PageOverviewZoom from '@plitzi/plitzi-ui/icons/PageOverviewZoom';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import clsx from 'clsx';
import { useCallback, use, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import Transform from '@pmodules/Transformers/Transform';

import BuilderElementTools from '../BuilderElementTools';

import type { BuilderState, Element } from '@plitzi/sdk-shared';

export type BuilderAreaHeaderProps = {
  baseElementId: string;
  element?: Element;
  isActive?: boolean;
  headerTitle?: string;
  previewMode?: boolean;
};

const BuilderAreaHeader = ({
  baseElementId,
  element,
  isActive = false,
  headerTitle = '',
  previewMode = false
}: BuilderAreaHeaderProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[pageFolders, definition, pageDefinitions, elementSelected, setSelected]] = useStore([
    'schema.pageFolders',
    'schema.definition',
    'pageDefinitions',
    'elementSelected',
    'setSelected'
  ]);
  const { existsPopup, addPopup } = usePopup();
  const {
    theme,
    setTheme,
    multiPagesMode,
    setMultiPagesMode,
    hasMultiPages,
    builderSetBaseContext,
    baseElementIdOriginal,
    mode
  } = use(BuilderContext);
  const {
    server: { basePath }
  } = use(NetworkContext);

  const handleClickBackToInstance = useCallback(() => builderSetBaseContext(), [builderSetBaseContext]);

  const handleClickTheme = useCallback(() => {
    setTheme(state => {
      if (state === 'light') {
        return 'dark';
      }

      return 'light';
    });
  }, [setTheme]);

  const handleClickTransform = useCallback(() => {
    if (!existsPopup('transform')) {
      addPopup('transform', <Transform />, {
        icon: <i className="fa-brands fa-nfc-symbol text-base" />,
        title: 'Transform And Import',
        height: 400,
        width: 800,
        allowLeftSide: true,
        allowRightSide: true,
        placement: 'floating',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup]);

  const handleClickMultipage = useCallback(() => {
    if (elementSelected) {
      setSelected(undefined);
    }

    setMultiPagesMode(!multiPagesMode);
  }, [elementSelected, multiPagesMode, setMultiPagesMode, setSelected]);

  const handleClickSettings = useCallback(() => {
    setSelected(baseElementId);
    if (!existsPopup('element-tools')) {
      addPopup('element-tools', <BuilderElementTools />, {
        icon: <i className="fas fa-tools text-base" />,
        title: 'Tools',
        resizeHandles: ['se'],
        width: 350,
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right'
      });
    }
  }, [addPopup, baseElementId, existsPopup, mode, setSelected]);

  const fullpath = useMemo(() => {
    const path = getPageFullPath(pageDefinitions, pageFolders, baseElementId, true);
    if (path === '/') {
      return '';
    }

    return path;
  }, [pageDefinitions, pageFolders, baseElementId]);

  const title = get(element, 'attributes.name', 'Page') as string;
  const defaultPage = get(element, 'attributes.default', false) as boolean;

  const domain = useMemo(() => {
    let url = definition.permanentUrl
      ? `https://${definition.permanentUrl}.plitzi.app`
      : 'https://subdomain.plitzi.app';
    if (!defaultPage) {
      url = `${url}${fullpath.replaceAll('//', '/')}`;
    }

    return url;
  }, [definition, defaultPage, fullpath]);

  const pageTitle = useMemo(() => {
    if (headerTitle) {
      return headerTitle;
    }

    if (multiPagesMode) {
      return title;
    }

    return domain;
  }, [headerTitle, multiPagesMode, domain, title]);

  return (
    <Flex
      items="center"
      gap={4}
      className="h-10 min-h-10 rounded-tl-lg rounded-tr-lg border-b border-gray-200 bg-white pr-2 pl-4 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <Flex items="center" gap={2}>
        <div
          className={clsx('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={clsx('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={clsx('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        {!multiPagesMode && baseElementIdOriginal !== baseElementId && (
          <Button size="xs" iconPlacement="before" className="gap-1" onClick={handleClickBackToInstance}>
            <Button.Icon icon="fas fa-arrow-left" />
            Back
          </Button>
        )}
      </Flex>
      <div title="Default Page" className={clsx({ 'text-primary-400': defaultPage, 'text-gray-400': !defaultPage })}>
        <Icon icon="fas fa-home" />
      </div>
      <Flex
        items="center"
        grow
        className="h-7 overflow-hidden rounded-lg border border-gray-200 px-3 select-none dark:border-zinc-700 dark:text-zinc-400"
      >
        <div className="mr-4 w-full truncate">{pageTitle}</div>
      </Flex>
      <Icon
        icon="fa-brands fa-nfc-symbol"
        className="cursor-pointer"
        title="Transform And Import"
        onClick={handleClickTransform}
      />
      <div title="Theme" className="flex cursor-pointer" onClick={handleClickTheme}>
        {theme === 'system' && <Icon icon="fa-solid fa-desktop" />}
        {theme === 'light' && <Icon icon="fa-solid fa-sun" />}
        {theme === 'dark' && <Icon icon="fa-solid fa-moon" />}
      </div>
      {!previewMode && (
        <Flex items="center" gap={3}>
          {hasMultiPages && (
            <div className="cursor-pointer" onClick={handleClickMultipage}>
              {!multiPagesMode && (
                <Icon title="Zoom into page overview">
                  <PageOverview />
                </Icon>
              )}
              {multiPagesMode && (
                <Link to={basePath ? `${basePath}/${baseElementId}` : baseElementId}>
                  <Icon title="Zoom in on this page">
                    <PageOverviewZoom />
                  </Icon>
                </Link>
              )}
            </div>
          )}
          <Icon icon="fas fa-cog" className="cursor-pointer" title="Domain Settings" onClick={handleClickSettings} />
          {mode === 'normal' && (
            <a href={domain} target="__blank" className="" title="Go to your space">
              <Icon icon="fa-solid fa-arrow-up-right-from-square" />
            </a>
          )}
        </Flex>
      )}
    </Flex>
  );
};

export default BuilderAreaHeader;
