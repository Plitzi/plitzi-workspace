// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Relatives
import formatBytes from '../../helpers/formatBytes';

/**
 * @param {{
 *   className?: string;
 *   backgroundColor?: string;
 *   icon?: string;
 *   name?: string;
 *   version?: string;
 *   author?: string;
 *   size?: number;
 *   components?: string;
 *   isUploaded?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const ContentPlugin = props => {
  const {
    className = '',
    backgroundColor = '#4422ee',
    icon = 'https://cdn.plitzi.com/resources/img/favicon.svg',
    name = 'Plugin Name',
    version = 'v0.0.0',
    author = 'Plitzi Team',
    size = 0,
    components = 'No components',
    isUploaded = false
  } = props;

  // const handleClickSettings = useCallback(async () => {
  //   const response = await showModal(
  //     <Modal.Header>
  //       <h4>{`${name} Settings`}</h4>
  //     </Modal.Header>,
  //     <Modal.Body>
  //       <PluginSettingsForm values={settings} />
  //     </Modal.Body>,
  //     null,
  //     {
  //       // style: { height: '90vh', width: '100%' }
  //     }
  //   );

  //   if (response) {
  //     onUpdate(response);
  //   }
  // }, [name, settings, onUpdate, showModal]);

  const finalSize = useMemo(() => formatBytes(size), [size]);

  return (
    <div className={classNames('group flex flex-col m-2 gap-2 overflow-hidden', className)}>
      <div className="flex items-center gap-3">
        <div
          className="h-11 w-11 flex items-center justify-center shrink-0 rounded-lg bg-gray-500"
          style={{ backgroundColor }}
        >
          <div className="p-1 flex items-center justify-center rounded-sm bg-white">
            <img src={icon} alt="" className="h-6 w-6" />
          </div>
        </div>
        <div className="flex flex-col grow basis-0 font-bold">
          <div className="truncate">{name}</div>
          <div className="text-xs">{version}</div>
        </div>
      </div>
      <div className="inline-flex gap-1 text-sm">
        <div className="font-bold">Author:</div>
        <div className="truncate">{author}</div>
      </div>
      <div className="flex flex-col text-sm">
        <div className="font-bold">Components Availables:</div>
        <div className="truncate">{components}</div>
      </div>
      {!isUploaded && (
        <div className="inline-flex gap-1 text-xs">
          <div className="font-bold">Size:</div>
          <div className="truncate">{finalSize}</div>
        </div>
      )}
    </div>
  );
};

export default ContentPlugin;
