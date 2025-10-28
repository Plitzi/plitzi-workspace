import classNames from 'classnames';
import { useMemo } from 'react';

import formatBytes from '@pmodules/Resources/components/ResourceManager/helpers/formatBytes';

export type PluginContentProps = {
  className?: string;
  backgroundColor?: string;
  icon?: string;
  name?: string;
  version?: string;
  author?: string;
  size?: number;
  components?: string;
  isUploaded?: boolean;
};

const PluginContent = ({
  className = '',
  backgroundColor = '#4422ee',
  icon = 'https://cdn.plitzi.com/resources/img/favicon.svg',
  name = 'Plugin Name',
  version = 'v0.0.0',
  author = 'Plitzi Team',
  size = 0,
  components = 'No components',
  isUploaded = false
}: PluginContentProps) => {
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
    <div className={classNames('group m-2 flex flex-col gap-1 overflow-hidden', className)}>
      <div className="flex items-center gap-2">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-500"
          style={{ backgroundColor }}
        >
          <div className="flex items-center justify-center rounded-sm bg-white p-1">
            <img src={icon} alt="" className="h-6 w-6" />
          </div>
        </div>
        <div className="flex grow basis-0 flex-col font-bold">
          <div className="truncate">{name}</div>
          <div className="text-xs">{version}</div>
        </div>
      </div>
      <div className="flex gap-1 text-sm">
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

export default PluginContent;
