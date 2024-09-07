// Packages
import React, { use } from 'react';
import classNames from 'classnames';

// Relatives
import DevToolsContext from './DevToolsContext';
import Logs from './components/Logs/Logs';

/**
 * @param {{
 *   className?: string;
 *   orientation: 'horizontal' | 'vertical';
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsBody = props => {
  const { className, orientation } = props;
  const { logs } = use(DevToolsContext);

  return (
    <div className={classNames('flex grow h-full bg-gray-50 w-full overflow-auto', className)}>
      <div className="flex flex-col gap-2 w-full">
        <Logs items={logs} orientation={orientation} />
      </div>
    </div>
  );
};

export default DevToolsBody;
