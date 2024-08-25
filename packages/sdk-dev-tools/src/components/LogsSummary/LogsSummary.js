// Packages
import React, { useMemo, useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Relatives
import { LOG_TYPE_DANGER, LOG_TYPE_INFO, LOG_TYPE_WARNING } from '../../utils/PlitziConsole';
import LogsSummaryItem from './LogsSummaryItem';

/**
 * @param {{
 *   className?: string;
 *   items: object[];
 *   logTypeSelected: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogsSummary = props => {
  const { className, items, logTypeSelected, onClick = noop } = props;

  const summary = useMemo(() => {
    return items.reduce((acc, log) => {
      const { logType } = log;
      if (!acc[logType]) {
        acc[logType] = 0;
      }

      return { ...acc, [logType]: ++acc[logType] };
    }, {});
  }, [items]);

  const handleClick = useCallback(logType => onClick(logType), [onClick]);

  return (
    <div className={classNames('flex flex-col border-r border-gray-300 select-none', className)}>
      <LogsSummaryItem onClick={handleClick} amount={items.length} selected={!logTypeSelected} />
      <LogsSummaryItem
        onClick={handleClick}
        amount={summary[LOG_TYPE_DANGER]}
        suffix="Errors"
        logType={LOG_TYPE_DANGER}
        selected={logTypeSelected === LOG_TYPE_DANGER}
      />
      <LogsSummaryItem
        onClick={handleClick}
        amount={summary[LOG_TYPE_WARNING]}
        suffix="Warnings"
        logType={LOG_TYPE_WARNING}
        selected={logTypeSelected === LOG_TYPE_WARNING}
      />
      <LogsSummaryItem
        onClick={handleClick}
        amount={summary[LOG_TYPE_INFO]}
        suffix="Info"
        logType={LOG_TYPE_INFO}
        selected={logTypeSelected === LOG_TYPE_INFO}
      />
    </div>
  );
};

export default LogsSummary;
