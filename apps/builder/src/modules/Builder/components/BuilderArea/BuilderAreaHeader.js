// Packages
import React, { useCallback, use, useMemo } from 'react';
import get from 'lodash/get';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import PageOverview from '@plitzi/plitzi-ui/icons/PageOverview';

// Monorepo
import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import BuilderContext from '../../BuilderContext';
import { BUILDER_MODE_NORMAL } from '../../BuilderProvider';
import BuilderSchemaContext from '../../contexts/BuilderSchemaContext';
import BuilderElementTools from '../BuilderElementTools';

/**
 * @param {{
 *   baseElementId: string;
 *   element: any;
 *   isActive?: boolean;
 *   headerTitle?: string;
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderAreaHeader = props => {
  const { baseElementId, element, isActive = false, headerTitle = '', previewMode = false } = props;
  const { existsPopup, addPopup } = usePopup();
  const { multiPagesMode, setMultiPagesMode, hasMultiPages, builderSetBaseContext, baseElementIdOriginal, mode } =
    use(BuilderContext);
  const {
    schema: { flat, pageFolders }
  } = use(BuilderSchemaContext);
  const {
    server: { domain }
  } = use(NetworkContext);
  const { elementSelected, setSelected } = use(BuilderSelectedContext);

  const handleClickBackToInstance = useCallback(() => builderSetBaseContext(), [builderSetBaseContext]);

  const handleClickMultipage = useCallback(() => {
    if (elementSelected) {
      setSelected(null);
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
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? 'floating' : 'right'
      });
    }
  }, [baseElementId, setSelected]);

  const fullpath = useMemo(() => {
    const path = getPageFullPath(flat, pageFolders, baseElementId, true);
    if (path === '/') {
      return '';
    }

    return path;
  }, [flat, pageFolders, baseElementId]);

  const title = get(element, 'attributes.name', 'Page');
  const defaultPage = get(element, 'attributes.default', false);
  const slug = get(element, 'attributes.slug', '');

  const domainName = useMemo(() => {
    let name = domain || 'https://subdomain.plitzi.app';
    if (name && !defaultPage) {
      name = `${name}${fullpath.replaceAll('//', '/')}`;
    }

    return name;
  }, [domain, defaultPage, slug, baseElementId, mode]);

  const pageTitle = useMemo(() => {
    if (headerTitle) {
      return headerTitle;
    }

    if (multiPagesMode) {
      return title;
    }

    let name = domain || 'https://subdomain.plitzi.app';
    if (name && !defaultPage) {
      name = `${name}${fullpath.replaceAll('//', '/')}`;
    }

    return name;
  }, [headerTitle, multiPagesMode, title, domain, defaultPage, slug, baseElementId, mode]);

  return (
    <Flex
      items="center"
      gap={4}
      className="h-10 min-h-[40px] pl-4 pr-2 bg-white rounded-tl-lg rounded-tr-lg border-b border-gray-300"
    >
      <Flex items="center" gap={2}>
        <div
          className={classNames('w-3 h-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={classNames('w-3 h-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={classNames('w-3 h-3 rounded-full', {
            'bg-secondary-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        {!multiPagesMode && baseElementIdOriginal !== baseElementId && (
          <Button size="custom" className="px-2 py-0.5 mr-2 rounded-md" onClick={handleClickBackToInstance}>
            <i className="fas fa-arrow-left mr-1" />
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
      <Flex items="center" grow className="h-7 px-3 rounded-lg select-none border border-gray-200 overflow-hidden">
        <div className="w-full truncate mr-4">{pageTitle}</div>
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
                <Link to={baseElementId}>
                  <Icon icon="fas fa-search-plus" title="Zoom in on this page" />
                </Link>
              )}
            </div>
          )}
          <Icon icon="fas fa-cog" className="cursor-pointer" title="Domain Settings" onClick={handleClickSettings} />
          {mode === BUILDER_MODE_NORMAL && (
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
