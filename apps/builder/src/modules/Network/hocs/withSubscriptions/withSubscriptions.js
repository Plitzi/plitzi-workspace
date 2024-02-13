// Packages
import React, { memo, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import omit from 'lodash/omit';
import set from 'lodash/set';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Alias
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import useWebsocket from '@pmodules/Network/hooks/useWebsocket';

// Relatives
import NetworkContext from '../../NetworkContext';
import { getDisplayName } from '../../../../helpers/utils';
import { RealTimeEventTypes, RealTimeEventTypesList, RealTimeSelfEventTypesList } from '../../helpers/EventTypes';

const withSubscriptions = WrappedComponent => {
  const WithSubscriptionsComponent = props => {
    const { includeRealTime = true, includeSubscriptions = true } = props;
    const { addToast } = useToast();
    const [messageCallbacks, setMessageCallbacks] = useState({});
    const [collaborators, setCollaborators] = useState([]);
    const { webKey, instanceId, server, userKey } = useContext(NetworkContext);

    const processMessage = useCallback(
      e => {
        const { type, payload } = JSON.parse(e.data);
        if (type && payload && type === RealTimeEventTypes.INIT) {
          // Init Realtime
          const collaborators = payload.collaborators.filter(collaborator => collaborator.instanceId !== instanceId);
          if (collaborators.length > 0) {
            setCollaborators(collaborators);
          }

          return;
        }

        if (!RealTimeEventTypesList.includes(type)) {
          // Invalid Packet
          return;
        }

        if (!type || !payload || !messageCallbacks[type] || payload.instanceId === instanceId) {
          return;
        }

        Object.keys(messageCallbacks[type])
          .filter(callbackKey => callbackKey !== instanceId || RealTimeSelfEventTypesList.includes(type))
          .forEach(callbackKey => messageCallbacks[type][callbackKey](payload));
      },
      [messageCallbacks]
    );

    const { push } = useWebsocket({
      url: `${server.websocketServer}?instanceId=${instanceId}&token=${webKey}&userToken=${userKey}`,
      protocols: ['realtime-ws'],
      processMessage,
      connectMode: includeRealTime ? 'auto' : 'manual'
    });

    const registerCallback = useCallback((key, type, callback) => {
      if (key && callback) {
        setMessageCallbacks(state => set(state, `${type}.${key}`, callback));
      }
    }, []);

    const unregisterCallback = useCallback((key, type) => {
      if (key) {
        setMessageCallbacks(state => omit(state, [`${type}.${key}`]));
      }
    }, []);

    useLayoutEffect(() => {
      if (includeSubscriptions) {
        registerCallback(instanceId, RealTimeEventTypes.COLLABORATOR_CONNECTED, payload => {
          const {
            user: { firstName, surName }
          } = payload;
          addToast(
            <div>
              Collaborator <b>{`${firstName} ${surName}`}</b> Joined into the WorkSpace
            </div>,
            {
              appeareance: 'info',
              autoDismiss: true,
              placement: 'top-right'
            }
          );

          setCollaborators(state => [...state, payload]);
        });

        registerCallback(instanceId, RealTimeEventTypes.COLLABORATOR_DISCONNECTED, payload => {
          const {
            user: { firstName, surName }
          } = payload;
          addToast(
            <div>
              Collaborator <b>{`${firstName} ${surName}`}</b> Left the WorkSpace
            </div>,
            {
              appeareance: 'info',
              autoDismiss: true,
              placement: 'top-right'
            }
          );

          setCollaborators(state => state.filter(item => item.instanceId !== payload.instanceId));
        });
      }

      return () => {
        if (includeSubscriptions) {
          unregisterCallback(instanceId, RealTimeEventTypes.COLLABORATOR_CONNECTED);
          unregisterCallback(instanceId, RealTimeEventTypes.COLLABORATOR_DISCONNECTED);
        }
      };
    }, [includeSubscriptions]);

    const subscriptionsValue = useMemo(
      () => ({
        includeSubscriptions,
        supportRealTime: includeRealTime,
        subscriptionsPush: push,
        subscriptionsRegisterCallback: registerCallback,
        subscriptionsUnregisterCallback: unregisterCallback,
        subscriptionsCollaborators: collaborators
      }),
      [includeSubscriptions, includeRealTime, push, registerCallback, unregisterCallback, collaborators]
    );

    return (
      <BuilderSubscriptionsContext.Provider value={subscriptionsValue}>
        <WrappedComponent {...omit(props, ['includeSubscriptions', 'includeRealTime'])} />
      </BuilderSubscriptionsContext.Provider>
    );
  };

  WithSubscriptionsComponent.displayName = `withSubscriptions(${getDisplayName(WrappedComponent)})`;

  WithSubscriptionsComponent.propTypes = {
    includeSubscriptions: PropTypes.bool,
    includeRealTime: PropTypes.bool
  };

  return memo(WithSubscriptionsComponent);
};

export default withSubscriptions;
