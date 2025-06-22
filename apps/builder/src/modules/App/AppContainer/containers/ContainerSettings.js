import React, { useCallback, use, useMemo, useState } from 'react';
import Card from '@plitzi/plitzi-ui-components/Card';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
// import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

import { EventBridgeModuleTypes, EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';

/** @returns {React.ReactElement} */
const ContainerSettings = () => {
  const { settings: settingsProp } = use(SchemaMainContext);
  const { eventBridge } = use(EventBridgeContext);

  const [settings, setSettings] = useState(settingsProp ?? {});
  const {
    // head = '', // @todo: pending to implement
    userProvider,
    keepState,
    stateStorage,
    // Provider - Auth0
    auth0Domain,
    auth0ClientId,
    // Provider - Basic
    loginUrl,
    refreshUrl,
    detailsPath = 'details',
    tokenPath = 'access_token',
    expirationTimePath = 'expire_at'
  } = settings;

  const handleChange = useCallback(
    name => e => {
      if (name === 'userProvider') {
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'auth0Domain');
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'auth0ClientId');
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'loginUrl');
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'refreshUrl');
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'detailsPath');
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'tokenPath');
        eventBridge.emit(
          EventBridgeModuleTypes.MAIN,
          EventBridgeTypes.SCHEMA_UPDATE_SETTINGS,
          '',
          'expirationTimePath'
        );
        setSettings(state => ({
          ...state,
          [name]: e.target.value,
          auth0Domain: '',
          auth0ClientId: '',
          loginUrl: '',
          refreshUrl: '',
          detailsPath: '',
          tokenPath: '',
          expirationTimePath: ''
        }));
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, e.target.value, name);
      } else if (name === 'keepState') {
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, '', 'stateStorage');
        setSettings(state => ({ ...state, [name]: e.target.checked }));
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, e.target.checked, name);
      } else if (name === 'head') {
        // setSettings(state => ({ ...state, [name]: e }));
        // eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, e, name);
      } else {
        setSettings(state => ({ ...state, [name]: e.target.value }));
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_SETTINGS, e.target.value, name);
      }
    },
    [eventBridge]
  );

  const keepStateProps = useMemo(() => ({ checked: keepState }), [keepState]);

  return (
    <Card className="relative flex grow basis-0 flex-col overflow-y-auto" rounded={false}>
      <div className="flex grow basis-0 flex-col gap-4 border-b border-gray-300 p-6">
        <Heading type="h4">User Settings</Heading>
        <FormControl
          name="userProvider"
          value={userProvider}
          onChange={handleChange('userProvider')}
          type="select"
          label="User Provider"
          placeholder="None"
          inputClassName="rounded-sm"
        >
          <option value="basic">Basic</option>
          <option value="auth0">Auth0</option>
        </FormControl>
        {userProvider === 'auth0' && (
          <>
            <FormControl
              name="auth0Domain"
              value={auth0Domain}
              onChange={handleChange('auth0Domain')}
              label="Auth0 Domain"
              inputClassName="rounded-sm"
            />
            <FormControl
              name="auth0ClientId"
              value={auth0ClientId}
              onChange={handleChange('auth0ClientId')}
              label="Auth0 Client ID"
              inputClassName="rounded-sm"
            />
          </>
        )}
        {userProvider === 'basic' && (
          <>
            <FormControl
              name="loginUrl"
              value={loginUrl}
              onChange={handleChange('loginUrl')}
              label="API Login Url"
              inputClassName="rounded-sm"
            />
            <FormControl
              name="refreshUrl"
              value={refreshUrl}
              onChange={handleChange('refreshUrl')}
              label="API Refresh Url (Optional)"
              inputClassName="rounded-sm"
            />
            <FormControl
              name="detailsPath"
              value={detailsPath}
              onChange={handleChange('detailsPath')}
              label="API Details Object Path - Default: [details] - example: [user.details]"
              inputClassName="rounded-sm"
            />
            <FormControl
              name="tokenPath"
              value={tokenPath}
              onChange={handleChange('tokenPath')}
              label="API Token Object Path - Default: [access_token] - example: [user.access_token]"
              inputClassName="rounded-sm"
            />
            <FormControl
              name="expirationTimePath"
              value={expirationTimePath}
              onChange={handleChange('expirationTimePath')}
              label="API Expiration Time Object Path - Default: [expire_at] - example: [user.expire_at]"
              inputClassName="rounded-sm"
            />
          </>
        )}
      </div>
      <div className="flex grow basis-0 flex-col gap-4 border-b border-gray-300 p-6">
        <Heading type="h4">State Settings</Heading>
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
            inputClassName="rounded-sm"
          >
            <option value="local">Local Storage</option>
            <option value="session">Session Storage</option>
          </FormControl>
        )}
      </div>
      {/* <div className="p-6 border-b border-gray-300 grow basis-0 flex flex-col gap-4">
        <Heading type="h4">Space Settings</Heading>
        <CodeMirror
          value={head}
          theme="dark"
          className="min-h-[300px]"
          lineWrapping
          onChange={handleChange('head')}
          mode="html"
        />
      </div> */}
    </Card>
  );
};

export default ContainerSettings;
