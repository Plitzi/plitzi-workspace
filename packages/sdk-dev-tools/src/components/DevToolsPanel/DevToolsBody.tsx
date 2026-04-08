import clsx from 'clsx';
import { use } from 'react';

import DevToolsContext from '@plitzi/sdk-shared/devTools/DevToolsContext';

import DataSourceViewer from './tabs/DataSourceViewer';
import ElementsViewer from './tabs/ElementsViewer';
import Logs from './tabs/Logs';
import PluginsViewer from './tabs/PluginsViewer/PluginsViewer';
import VariablesViewer from './tabs/VariablesViewer';

export type DevToolsBodyProps = {
  className?: string;
  tabSelected?: string;
  orientation: 'horizontal' | 'vertical';
  elementSelected?: string;
  onSelectElement: (id?: string) => void;
};

const DevToolsBody = ({ className, tabSelected, orientation, elementSelected, onSelectElement }: DevToolsBodyProps) => {
  const { logs, clearLogs } = use(DevToolsContext);

  return (
    <div className={clsx('flex h-full w-full grow overflow-auto bg-white dark:bg-zinc-900', className)}>
      <div className="flex w-full flex-col">
        {tabSelected === 'logs' && <Logs items={logs} orientation={orientation} onClear={clearLogs} />}
        {tabSelected === 'dataSources' && <DataSourceViewer elementSelected={elementSelected} />}
        {tabSelected === 'variables' && <VariablesViewer />}
        {tabSelected === 'elements' && (
          <ElementsViewer elementSelected={elementSelected} onSelectElement={onSelectElement} />
        )}
        {tabSelected === 'plugins' && <PluginsViewer />}
      </div>
    </div>
  );
};

export default DevToolsBody;
