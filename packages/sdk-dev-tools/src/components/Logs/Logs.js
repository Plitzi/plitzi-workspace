// Packages
import React, { useState, useCallback } from 'react';

// Relatives
import Log from './Log';
import LogsSummary from '../LogsSummary';

/**
 * @param {{
 *   className?: string;
 *   items: object[];
 * }} props
 * @returns {React.ReactElement}
 */
const Logs = props => {
  const { items = [] } = props;
  const [logTypeSelected, setLogTypeSelected] = useState();

  const handleClickSummary = useCallback(logType => {
    setLogTypeSelected(logType);
  }, []);

  return (
    <div className="flex min-h-full w-full">
      <LogsSummary className="h-full" logTypeSelected={logTypeSelected} items={items} onClick={handleClickSummary} />
      <div className="flex flex-col grow h-full overflow-y-auto">
        {items &&
          items
            .filter(item => !logTypeSelected || item.logType === logTypeSelected)
            .map((item, i) => (
              <Log key={i} category={item.category} time={item.time} params={item.params} message={item.message} />
            ))}
      </div>
    </div>
  );
};

export default Logs;
