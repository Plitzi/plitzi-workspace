// Packages
import React, { useCallback, use } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

/**
 * @param {{
 *   className?: string;
 *   setTabSelected?: (tab: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PageHeader = props => {
  const { className, setTabSelected } = props;
  const { pageDefinitions } = use(SchemaMainContext);
  const { currentPageId } = use(NavigationContext);

  const handleClick = useCallback(() => {
    setTabSelected?.(state => (state === 'pages' ? '' : 'pages'));
  }, [setTabSelected]);

  const pageLabel = get(pageDefinitions, `${currentPageId}.attributes.name`, '');
  const isHome = get(pageDefinitions, `${currentPageId}.attributes.default`, false);

  return (
    <div
      className={classNames(
        'flex items-center select-none min-w-0 basis-0 grow text-xs gap-1 w-[126px] cursor-pointer',
        className
      )}
      title={pageLabel}
      onClick={handleClick}
    >
      {!isHome && <i className="fa-solid fa-file" />}
      {isHome && <i className="fas fa-home" />}
      <span className="font-bold truncate">{pageLabel}</span>
    </div>
  );
};

export default PageHeader;
