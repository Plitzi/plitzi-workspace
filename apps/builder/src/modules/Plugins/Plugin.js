// Packages
import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import Modal from '@plitzi/plitzi-ui-components/Modal';

// Relatives
import PluginSettingsForm from './Models/PluginSettingsForm';
import { emptyObject } from '../../helpers/utils';

const Plugin = props => {
  const {
    name = '',
    version = '',
    size,
    settings = emptyObject,
    newVersion = false,
    backgroundColor = '#fff',
    icon = '',
    onRemove = noop,
    onUpdate = noop,
    showModal = noop
  } = props;
  const [expand, setExpand] = useState(false);

  const handleClickRemove = useCallback(() => onRemove(), [onRemove]);

  const handleClickExpand = useCallback(() => setExpand(state => !state), []);

  const handleClickSettings = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>{`${name} Settings`}</h4>
      </Modal.Header>,
      <Modal.Body>
        <PluginSettingsForm values={settings} />
      </Modal.Body>,
      null,
      {
        placement: 'center',
        containerClassName: 'container',
        renderFooter: false
        // style: { height: '90vh', width: '100%' }
      }
    );

    if (response.result) {
      const { data } = response;
      onUpdate(data);
    }
  }, [name, settings, onUpdate]);

  return (
    <div key={name} className="group mb-1 flex flex-wrap justify-between items-center last:mb-0">
      <div
        className="h-11 w-11 flex items-center justify-center shrink-0 rounded-lg mr-3 bg-gray-500"
        style={{ backgroundColor }}
      >
        <div className="p-1 flex items-center justify-center rounded bg-white">
          <img src={icon} alt="" className="h-6 w-6" />
        </div>
      </div>
      <div className="mr-1 grow basis-0 font-bold truncate">
        {name}
        {newVersion && (
          <div className="ml-1 inline text-blue-400">
            <i className="fas fa-cloud-download-alt" title="New version available" />
          </div>
        )}
      </div>
      <div className="hidden group-hover:block">
        {size && (
          <Button intent="custom" size="custom" className="px-3" title="Show sizes" onClick={handleClickExpand}>
            {!expand && <i className="fas fa-angle-down" />}
            {expand && <i className="fas fa-angle-up" />}
          </Button>
        )}
        {Object.keys(settings).length > 0 && (
          <button type="button" title="Settings" onClick={handleClickSettings}>
            <i className="fas fa-cog" />
          </button>
        )}
        <button type="button" title="Remove" onClick={handleClickRemove}>
          <i className="fas fa-times" />
        </button>
      </div>
      <div className="font-bold group-hover:hidden">{version}</div>
      {expand && (
        <div className="w-full mb-1 flex justify-between items-center">
          {Object.keys(size).map(sizeKey => {
            return (
              <div key={sizeKey} className="font-bold text-xs capitalize">
                {`${sizeKey}: ${size[sizeKey]}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

Plugin.propTypes = {
  name: PropTypes.string,
  size: PropTypes.object,
  newVersion: PropTypes.bool,
  version: PropTypes.string,
  backgroundColor: PropTypes.string,
  icon: PropTypes.string,
  settings: PropTypes.object,
  onUpdate: PropTypes.func,
  onRemove: PropTypes.func,
  showModal: PropTypes.func
};

export default Plugin;
