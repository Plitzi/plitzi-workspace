// Packages
import React, { useEffect, useMemo, useState } from 'react';

// Relatives
import EventBridgeContext from './EventBridgeContext';
import EventBridge from './EventBridge';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const EventBridgeContextProvider = props => {
  const { children } = props;
  const [eventBridge] = useState(() => new EventBridge());

  useEffect(() => {
    return () => {
      eventBridge.clear();
    };
  }, []);

  const valueMemo = useMemo(() => ({ eventBridge }), [eventBridge]);

  return <EventBridgeContext value={valueMemo}>{children}</EventBridgeContext>;
};

export default EventBridgeContextProvider;
