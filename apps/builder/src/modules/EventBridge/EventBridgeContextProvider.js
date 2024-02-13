// Packages
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

// Relatives
import EventBridgeContext from './EventBridgeContext';
import EventBridge from './EventBridge';

const EventBridgeContextProvider = props => {
  const { children } = props;
  const [eventBridge] = useState(() => new EventBridge());

  useEffect(() => {
    return () => {
      eventBridge.clear();
    };
  }, []);

  const valueMemo = useMemo(() => ({ eventBridge }), [eventBridge]);

  return <EventBridgeContext.Provider value={valueMemo}>{children}</EventBridgeContext.Provider>;
};

EventBridgeContextProvider.propTypes = {
  children: PropTypes.node
};

export default EventBridgeContextProvider;
