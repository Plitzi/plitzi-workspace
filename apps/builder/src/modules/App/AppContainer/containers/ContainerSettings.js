// Packages
import React, { useCallback, useContext, useMemo, useState } from 'react';
import Card from '@plitzi/plitzi-ui-components/Card';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';

// Monorepo
import { EventBridgeModuleTypes, EventBridgeTypes } from '@repo/event-bridge/EventBridgeHelper';
import EventBridgeContext from '@repo/event-bridge/EventBridgeContext';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

const ContainerSettings = () => {
  const { settings: settingsProp } = useContext(SchemaMainContext);
  const { eventBridge } = useContext(EventBridgeContext);

  const [settings, setSettings] = useState(settingsProp ?? {});
  const { userProvider, auth0Domain, auth0ClientId, keepState, stateStorage } = settings;

  const handleChange = useCallback(
    name => e => {
      if (name === 'userProvider') {
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'auth0Domain');
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'auth0ClientId');
        setSettings(state => ({ ...state, [name]: e.target.value, auth0Domain: '', auth0ClientId: '' }));
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, e.target.value, name);
      } else if (name === 'keepState') {
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'stateStorage');
        setSettings(state => ({ ...state, [name]: e.target.checked }));
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, e.target.checked, name);
      } else {
        setSettings(state => ({ ...state, [name]: e.target.value }));
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, e.target.value, name);
      }
    },
    [eventBridge]
  );

  const keepStateProps = useMemo(() => ({ checked: keepState }), [keepState]);

  return (
    <Card className="mx-[5%] grow basis-0 m-4 relative flex flex-col">
      <div className="p-6 border-b border-gray-300">
        <Heading className="mb-4" type="h4">
          User Settings
        </Heading>
        <FormControl
          name="userProvider"
          value={userProvider}
          onChange={handleChange('userProvider')}
          type="select"
          label="User Provider"
          placeholder="None"
          inputClassName="rounded"
        >
          <option value="plitzi">Plitzi</option>
          <option value="auth0">Auth0</option>
        </FormControl>
        {userProvider === 'auth0' && (
          <>
            <FormControl
              name="auth0Domain"
              value={auth0Domain}
              onChange={handleChange('auth0Domain')}
              label="Auth0 Domain"
              className="mt-4"
              inputClassName="rounded"
            />
            <FormControl
              name="auth0ClientId"
              value={auth0ClientId}
              onChange={handleChange('auth0ClientId')}
              label="Auth0 Client ID"
              className="mt-4"
              inputClassName="rounded"
            />
          </>
        )}
      </div>
      <div className="p-6 border-b border-gray-300">
        <Heading className="mb-4" type="h4">
          State Settings
        </Heading>
        <FormControl
          name="keepState"
          inputProps={keepStateProps}
          onChange={handleChange('keepState')}
          type="checkbox"
          label="Keep State"
        />
        {keepState && (
          <FormControl
            name="stateStorage"
            value={stateStorage}
            onChange={handleChange('stateStorage')}
            type="select"
            label="User Provider"
            placeholder="None"
            inputClassName="rounded"
          >
            <option value="local">Local Storage</option>
            <option value="session">Session Storage</option>
          </FormControl>
        )}
      </div>
    </Card>
  );
};

ContainerSettings.propTypes = {};

export default ContainerSettings;
