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

import { getPageFullPath } from '@plitzi/sdk-navigation';
import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { useTheme, SPACE_THEME_AREA } from '@plitzi/sdk-shared/theme/react';
import AppContext from '@pmodules/App/AppContext';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import Transform from '@pmodules/Transformers/Transform';

import BuilderElementTools from '../BuilderElementTools';
import PreviewVisitor from './PreviewVisitor';

import type { Element } from '@plitzi/sdk-shared';

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
  const [[pageFolders, definition, pageDefinitions, elementSelected, setSelected]] = useBuilderStore([
    'schema.pageFolders',
    'schema.definition',
    'pageDefinitions',
    'elementSelected',
    'setSelected'
  ]);
  const { existsPopup, addPopup } = usePopup();
  const { reloadPage, newVisitor } = use(AppContext);
  const { multiPagesMode, setMultiPagesMode, hasMultiPages, builderSetBaseContext, baseElementIdOriginal, mode } =
    use(BuilderContext);
  const {
    server: { basePath }
  } = useBuilderNetwork();

  const handleClickBackToInstance = useCallback(() => builderSetBaseContext(), [builderSetBaseContext]);

  /**
   * This control owns how the SPACE is painted, everywhere it is painted — the canvas under this header and every
   * `BuilderAreaPreview` too. It is not the editor's own theme, and it goes back to following it when that moves.
   */
  const { theme: themeArea, toggleTheme: handleClickTheme } = useTheme(SPACE_THEME_AREA);

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
    const url = `https://${definition.permanentUrl ? definition.permanentUrl : 'subdomain'}.plitzi.app`;

    return defaultPage ? url : `${url}${fullpath.replaceAll('//', '/')}`;
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
      className="border-ui-line bg-ui-raised h-10 min-h-10 rounded-tl-lg rounded-tr-lg border-b px-4"
    >
      <Flex items="center" gap={2}>
        <div
          className={clsx('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-ui-line-strong': !isActive
          })}
        />
        <div
          className={clsx('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-ui-line-strong': !isActive
          })}
        />
        <div
          className={clsx('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-ui-line-strong': !isActive
          })}
        />
        {!multiPagesMode && baseElementIdOriginal !== baseElementId && (
          <Button size="xs" iconPlacement="before" className="gap-1" onClick={handleClickBackToInstance}>
            <Button.Icon icon="fas fa-arrow-left" />
            Back
          </Button>
        )}
      </Flex>
      <div title="Default Page" className={clsx({ 'text-primary-ui': defaultPage, 'text-ui-fg-subtle': !defaultPage })}>
        <Icon icon="fas fa-home" />
      </div>
      {previewMode && (
        <>
          <button
            type="button"
            title="Reload — as a browser's F5: what the page set for this visit is emptied, what it keeps stays, and it loads again"
            aria-label="Reload the page"
            className="text-ui-fg-subtle hover:text-ui-fg flex"
            onClick={reloadPage}
          >
            <Icon icon="fa-solid fa-rotate-right" />
          </button>
          <button
            type="button"
            title="New visitor — a first visit: nothing kept, and the variants set to Draw drawn again by their shares"
            aria-label="Show the page to a new visitor"
            className="text-ui-fg-subtle hover:text-ui-fg flex"
            onClick={newVisitor}
          >
            <Icon icon="fa-solid fa-user-plus" />
          </button>
        </>
      )}
      <Flex
        items="center"
        grow
        className="border-ui-line dark:text-ui-fg-subtle h-7 overflow-hidden rounded-lg border px-3 select-none"
      >
        <div className="mr-4 w-full truncate">{pageTitle}</div>
      </Flex>
      {!previewMode && (
        <Icon
          icon="fa-brands fa-nfc-symbol"
          className="cursor-pointer"
          title="Transform And Import"
          onClick={handleClickTransform}
        />
      )}
      <PreviewVisitor />
      <div title="Theme" className="flex cursor-pointer" onClick={handleClickTheme}>
        {themeArea === 'system' && <Icon icon="fa-solid fa-desktop" />}
        {themeArea === 'dark' && <Icon icon="fa-solid fa-sun" />}
        {themeArea === 'light' && <Icon icon="fa-solid fa-moon" />}
      </div>
      {!previewMode && (
        <Flex items="center" gap={3}>
          {hasMultiPages && (
            <div className="cursor-pointer" onClick={handleClickMultipage}>
              {!multiPagesMode && (
                <Icon title="Zoom into page overview">
                  <PageOverview className="h-4 w-4" />
                </Icon>
              )}
              {multiPagesMode && (
                <Link to={basePath ? `${basePath}/${baseElementId}` : baseElementId}>
                  <Icon title="Zoom in on this page">
                    <PageOverviewZoom className="h-4 w-4" />
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
