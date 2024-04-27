// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   selected?: string;
 *   onSelect?: (item: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const AppSidebar = props => {
  const { className = '', selected = '', onSelect = noop } = props;

  const handleClick = item => () => {
    if (selected === item) {
      onSelect(undefined);
    } else {
      onSelect(item);
    }
  };

  return (
    <div id="sidebar" className={classNames('flex box-border bg-gray-700 items-center', className)}>
      <ul className="flex flex-col items-center m-0 p-0 list-none w-14 py-4 grow justify-center">
        <li
          id="sidebar-elements"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'elements',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'elements'
          })}
          onClick={handleClick('elements')}
          title="Elements"
        >
          <i className="fa-solid fa-plus h-6 w-6 flex items-center justify-center" />
        </li>
        {/* <li
          id="sidebar-sitemap"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'sitemap',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'sitemap'
          })}
          onClick={handleClick('sitemap')}
          title="Sitemap"
        >
          <i className="fa-solid fa-sitemap h-6 w-6 flex items-center justify-center" />
        </li> */}
        <li
          id="sidebar-pages"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'pages',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'pages'
          })}
          onClick={handleClick('pages')}
          title="Pages"
        >
          <i className="fas fa-file h-6 w-6 flex items-center justify-center" />
        </li>
        <li
          id="sidebar-assets"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'assets',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'assets'
          })}
          onClick={handleClick('assets')}
          title="Assets"
        >
          <i className="fas fa-box-open h-6 w-6 flex items-center justify-center" />
        </li>
        <li
          id="sidebar-collections"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'collections',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'collections'
          })}
          onClick={handleClick('collections')}
          title="Collections"
        >
          <i className="fas fa-database h-6 w-6 flex items-center justify-center" />
        </li>
        <li
          id="sidebar-segments"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'segments',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'segments'
          })}
          onClick={handleClick('segments')}
          title="Segments"
        >
          <i className="fas fa-cubes h-6 w-6 flex items-center justify-center" />
        </li>
        <li
          id="sidebar-templates"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'templates',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'templates'
          })}
          onClick={handleClick('templates')}
          title="Templates"
        >
          <i className="fa-solid fa-pen-ruler h-6 w-6 flex items-center justify-center" />
        </li>
        {/* <li
          id="sidebar-integrations"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'integrations',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'integrations'
          })}
          onClick={handleClick('integrations')}
          title="integrations"
        >
          <i className="fa-solid fa-sliders h-6 w-6 flex items-center justify-center" />
        </li> */}
        {/* <li
          id="sidebar-marketplace"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'marketplace',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'marketplace'
          })}
          onClick={handleClick('marketplace')}
          title="Marketplace"
        >
          <i className="fa-solid fa-store h-6 w-6 flex items-center justify-center" />
        </li> */}
        <li
          id="sidebar-settings"
          className={classNames('py-2 px-2 my-1 flex flex-col items-center rounded-lg cursor-pointer', {
            'text-gray-300 bg-gray-600': selected === 'settings',
            'text-gray-500 hover:text-gray-300 hover:bg-gray-600': selected !== 'settings'
          })}
          onClick={handleClick('settings')}
          title="Settings"
        >
          <i className="fas fa-cog h-6 w-6 flex items-center justify-center" />
        </li>
      </ul>
    </div>
  );
};

export default AppSidebar;
