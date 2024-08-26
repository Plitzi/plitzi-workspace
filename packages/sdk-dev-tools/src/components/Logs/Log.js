// Packages
import React from 'react';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import LogInteraction from './categories/LogInteraction';

/**
 * @param {{
 *   className?: string;
 *   category: string;
 *   time: string;
 *   message?: string;
 *   params?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const Log = props => {
  const { category, message, time, params = emptyObject } = props;

  return (
    <>
      {category === 'interactions' && <LogInteraction message={message} params={params} time={time} />}
      {/* {category === 'dataSources' && <LogDataSource message={message} params={params} />} */}
    </>
  );
};

export default Log;
