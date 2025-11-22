import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import PageOverview from '@plitzi/plitzi-ui/icons/PageOverview';
import PageOverviewZoom from '@plitzi/plitzi-ui/icons/PageOverviewZoom';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import classNames from 'classnames';
import get from 'lodash-es/get';
import { useCallback, use, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import BuilderElementTools from '../BuilderElementTools';

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
  const { existsPopup, addPopup } = usePopup();
  const { multiPagesMode, setMultiPagesMode, hasMultiPages, builderSetBaseContext, baseElementIdOriginal, mode } =
    use(BuilderContext);
  const {
    schema: { flat, pageFolders }
  } = use(BuilderSchemaContext);
  const {
    server: { domain, basePath }
  } = use(NetworkContext);
  const { elementSelected, setSelected } = use(BuilderSelectedContext);

  const handleClickBackToInstance = useCallback(() => builderSetBaseContext(), [builderSetBaseContext]);

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
    const path = getPageFullPath(flat, pageFolders, baseElementId, true);
    if (path === '/') {
      return '';
    }

    return path;
  }, [flat, pageFolders, baseElementId]);

  const title = get(element, 'attributes.name', 'Page') as string;
  const defaultPage = get(element, 'attributes.default', false);

  const domainName = useMemo(() => {
    let name: string = domain || 'https://subdomain.plitzi.app';
    if (name && !defaultPage) {
      name = `${name}${fullpath.replaceAll('//', '/')}`;
    }

    return name;
  }, [domain, defaultPage, fullpath]);

  const pageTitle = useMemo(() => {
    if (headerTitle) {
      return headerTitle;
    }

    if (multiPagesMode) {
      return title;
    }

    let name: string = domain || 'https://subdomain.plitzi.app';
    if (name && !defaultPage) {
      name = `${name}${fullpath.replaceAll('//', '/')}`;
    }

    return name;
  }, [headerTitle, multiPagesMode, domain, defaultPage, title, fullpath]);

  return (
    <Flex
      items="center"
      gap={4}
      className="h-10 min-h-10 rounded-tl-lg rounded-tr-lg border-b border-gray-300 bg-white pr-2 pl-4"
    >
      <Flex items="center" gap={2}>
        <div
          className={classNames('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={classNames('h-3 w-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={classNames('h-3 w-3 rounded-full', {
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
      <div
        title="Default Page"
        className={classNames({ 'text-primary-400': defaultPage, 'text-gray-400': !defaultPage })}
      >
        <Icon icon="fas fa-home" />
      </div>
      <Flex items="center" grow className="h-7 overflow-hidden rounded-lg border border-gray-200 px-3 select-none">
        <div className="mr-4 w-full truncate">{pageTitle}</div>
      </Flex>
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
            <a href={domainName} target="__blank" className="" title="Go to your space">
              <Icon icon="fa-solid fa-arrow-up-right-from-square" />
            </a>
          )}
        </Flex>
      )}
    </Flex>
  );
};

export default BuilderAreaHeader;
