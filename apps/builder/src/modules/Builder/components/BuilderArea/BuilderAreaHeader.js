// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';
import usePopup from '@plitzi/plitzi-ui-components/Popup/usePopup';
import { POPUP_PLACEMENT_RIGHT, POPUP_PLACEMENT_FLOATING } from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

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

const BuilderAreaHeader = props => {
  const { baseElementId, element, isActive = false, headerTitle = '', previewMode = false } = props;
  const { existsPopup, addPopup } = usePopup();
  const { multiPagesMode, setMultiPagesMode, hasMultiPages, builderSetBaseContext, baseElementIdOriginal, mode } =
    useContext(BuilderContext);
  const {
    schema: { flat, pageFolders }
  } = useContext(BuilderSchemaContext);
  const {
    server: { domain }
  } = useContext(NetworkContext);
  const { elementSelected, setSelected } = useContext(BuilderSelectedContext);

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
      const title = (
        <>
          <i className="fas fa-tools m-1 text-base" />
          Tools
        </>
      );
      addPopup('element-tools', <BuilderElementTools />, {
        resizeHandles: ['se'],
        width: 350,
        title,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT
      });
    }
  }, [baseElementId, setSelected]);

  const fullpath = useMemo(
    () => getPageFullPath(flat, pageFolders, baseElementId, true),
    [flat, pageFolders, baseElementId]
  );

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
    <div className="h-10 min-h-[40px] pl-4 pr-2 flex items-center bg-white rounded-tl rounded-tr border-b border-gray-300">
      <div className="flex items-center">
        <div
          className={classNames('w-3 h-3 mr-2 rounded-full', {
            'bg-blue-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={classNames('w-3 h-3 mr-2 rounded-full', {
            'bg-blue-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          className={classNames('w-3 h-3 mr-2 rounded-full', {
            'bg-blue-400': isActive,
            'bg-gray-300': !isActive
          })}
        />
        <div
          title="Default Page"
          className={classNames('mr-2', { 'text-blue-400': defaultPage, 'text-gray-400': !defaultPage })}
        >
          <i className="fas fa-home" />
        </div>
        {!multiPagesMode && baseElementIdOriginal !== baseElementId && (
          <Button size="custom" className="px-2 py-0.5 mr-2 rounded-md" onClick={handleClickBackToInstance}>
            <i className="fas fa-arrow-left mr-1" />
            Back
          </Button>
        )}
      </div>
      <div className="h-7 px-3 flex items-center grow justify-between rounded bg-gray-200 select-none border border-gray-400 overflow-hidden">
        <div className="w-full truncate mr-4">{pageTitle}</div>
        {!previewMode && (
          <div className="flex items-center">
            {mode === BUILDER_MODE_NORMAL && (
              <a href={domainName} target="__blank" className="hover:text-blue-400 mr-4" title="Go to your space">
                <i className="fa-solid fa-arrow-up-right-from-square" />
              </a>
            )}
            <i
              className="fas fa-cog cursor-pointer hover:text-blue-400"
              title="Domain Settings"
              onClick={handleClickSettings}
            />
          </div>
        )}
      </div>
      {hasMultiPages && !previewMode && (
        <div className="ml-2 hover:text-blue-400 cursor-pointer" onClick={handleClickMultipage}>
          {!multiPagesMode && <i className="fas fa-search-minus" title="Zoom into page overview" />}
          {multiPagesMode && (
            <Link to={baseElementId} className="hover:text-blue-400">
              <i className="fas fa-search-plus hover:text-blue-400" title="Zoom in on this page" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

BuilderAreaHeader.propTypes = {
  headerTitle: PropTypes.string,
  baseElementId: PropTypes.string,
  element: PropTypes.object,
  isActive: PropTypes.bool,
  previewMode: PropTypes.bool
};

export default BuilderAreaHeader;
