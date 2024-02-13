// Packages
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Relatives
import EventBridgeContext from './EventBridgeContext';
import EventBridge from './EventBridge';

const EventBridgeContextProvider = props => {
  const { children, onInit = noop } = props;
  const [eventBridge] = useState(() => new EventBridge());

  useEffect(() => {
    return () => {
      eventBridge.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof onInit === 'function') {
      onInit(eventBridge);
    }
  }, [onInit, eventBridge]);

  const valueMemo = useMemo(() => ({ eventBridge }), [eventBridge]);

  return <EventBridgeContext.Provider value={valueMemo}>{children}</EventBridgeContext.Provider>;
};

EventBridgeContextProvider.propTypes = {
  children: PropTypes.node,
  onInit: PropTypes.func
};

export default EventBridgeContextProvider;
