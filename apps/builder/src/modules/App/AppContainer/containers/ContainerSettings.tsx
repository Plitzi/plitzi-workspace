import Alert from '@plitzi/plitzi-ui/Alert';
import Card from '@plitzi/plitzi-ui/Card';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Heading from '@plitzi/plitzi-ui/Heading';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, use, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { ChangeEvent } from 'react';

const ContainerSettings = () => {
  const [[settingsProp, styleMode]] = useBuilderStore(['schema.settings', 'style.mode']);
  const { eventBridge } = use(EventBridgeContext);

  const [settings, setSettings] = useState(settingsProp);
  const {
    // head = '', // @todo: pending to implement
    userProvider,
    keepState,
    stateStorage,
    // Provider - Auth0
    auth0Domain,
    auth0ClientId,
    // Provider - Basic
    tokenStorage = 'localStorage',
    loginUrl,
    userUrl,
    refreshUrl,
    logoutUrl,
    detailsPath = 'details',
    tokenPath = 'access_token',
    expirationTimePath = 'expire_at'
  } = settings;

  const handleChangeKeepState = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void eventBridge.emit('main', 'schemaUpdateSettings', '', 'stateStorage');
      setSettings(state => ({ ...state, keepState: e.target.checked }));
      void eventBridge.emit('main', 'schemaUpdateSettings', e.target.checked, 'keepState');
    },
    [eventBridge]
  );

  const handleChange = useCallback(
    (name: string) => (value: string) => {
      if (name === 'userProvider') {
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'auth0Domain');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'auth0ClientId');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'loginUrl');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'userUrl');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'logoutUrl');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'refreshUrl');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'detailsPath');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'tokenPath');
        void eventBridge.emit('main', 'schemaUpdateSettings', '', 'expirationTimePath');
        setSettings(state => ({
          ...state,
          [name]: value as 'basic' | 'auth0' | '',
          auth0Domain: '',
          auth0ClientId: '',
          loginUrl: '',
          userUrl: '',
          refreshUrl: '',
          logoutUrl: '',
          detailsPath: '',
          tokenPath: '',
          expirationTimePath: ''
        }));
        void eventBridge.emit('main', 'schemaUpdateSettings', value, name);
      } else if (name === 'head') {
        // setSettings(state => ({ ...state, [name]: e }));
        // eventBridge.emit('main', 'schemaUpdateSettings', e, name);
      } else {
        setSettings(state => ({ ...state, [name]: value }));
        void eventBridge.emit('main', 'schemaUpdateSettings', value, name);
      }
    },
    [eventBridge]
  );

  const handleChangeMode = useCallback(
    (value: string) => {
      void eventBridge.emit('main', 'styleUpdateSettings', 'mode', value);
    },
    [eventBridge]
  );

  return (
    <Card className="flex grow basis-0 flex-col" rounded="none">
      <Card.Body className="overflow-y-auto" grow>
        <div className="flex grow basis-0 flex-col gap-4 border-b border-gray-300 p-6">
          <Heading as="h4">User Settings</Heading>
          <Select
            size="sm"
            name="userProvider"
            value={userProvider}
            onChange={handleChange('userProvider')}
            label="User Provider"
            placeholder="None"
          >
            <option value="basic">Basic</option>
            <option value="auth0">Auth0</option>
          </Select>
          <Select
            size="sm"
            name="tokenStorage"
            value={tokenStorage}
            onChange={handleChange('tokenStorage')}
            label="Token Storage"
            placeholder="None"
          >
            <option value="localStorage">Local Storage</option>
            <option value="sessionStorage">Session Storage</option>
          </Select>
          {userProvider === 'auth0' && (
            <>
              <Input
                size="sm"
                name="auth0Domain"
                value={auth0Domain}
                onChange={handleChange('auth0Domain')}
                label="Auth0 Domain"
              />
              <Input
                size="sm"
                name="auth0ClientId"
                value={auth0ClientId}
                onChange={handleChange('auth0ClientId')}
                label="Auth0 Client ID"
              />
            </>
          )}
          {userProvider === 'basic' && (
            <>
              <Input
                size="sm"
                name="loginUrl"
                value={loginUrl}
                onChange={handleChange('loginUrl')}
                label="API Login Url"
              />
              <Input
                size="sm"
                name="userUrl"
                value={userUrl}
                onChange={handleChange('userUrl')}
                label="API User Profile Url"
              />
              <Input
                size="sm"
                name="refreshUrl"
                value={refreshUrl}
                onChange={handleChange('refreshUrl')}
                label="API Refresh Url (Optional)"
              />
              <Input
                size="sm"
                name="logoutUrl"
                value={logoutUrl}
                onChange={handleChange('logoutUrl')}
                label="API Logout Url"
              />
              <Input
                size="sm"
                name="detailsPath"
                value={detailsPath}
                onChange={handleChange('detailsPath')}
                label="API Details Object Path - Default: [details] - example: [user.details]"
              />
              <Input
                size="sm"
                name="tokenPath"
                value={tokenPath}
                onChange={handleChange('tokenPath')}
                label="API Token Object Path - Default: [access_token] - example: [user.access_token]"
              />
              <Input
                size="sm"
                name="expirationTimePath"
                value={expirationTimePath}
                onChange={handleChange('expirationTimePath')}
                label="API Expiration Time Object Path - Default: [expire_at] - example: [user.expire_at]"
              />
            </>
          )}
        </div>
        <div className="flex grow basis-0 flex-col gap-4 border-b border-gray-300 p-6">
          <Heading as="h4">Style Settings</Heading>
          <Alert intent="info" size="xs" solid={false}>
            Keep on mind that changing this can impact your style
          </Alert>
          <Select
            size="sm"
            name="mode"
            value={styleMode}
            onChange={handleChangeMode}
            label="Style Mode (Breakpoint system)"
            placeholder="None"
          >
            <option value="desktop-first">Desktop First</option>
            <option value="mobile-first">Mobile First</option>
          </Select>
        </div>
        <div className="flex grow basis-0 flex-col gap-4 border-b border-gray-300 p-6">
          <Heading as="h4">State Settings</Heading>
          <Checkbox
            size="sm"
            name="keepState"
            checked={keepState}
            onChange={handleChangeKeepState}
            type="checkbox"
            label="Keep State"
          />
          {keepState && (
            <Select
              size="sm"
              name="stateStorage"
              value={stateStorage}
              onChange={handleChange('stateStorage')}
              label="State Storage"
              placeholder="None"
            >
              <option value="localStorage">Local Storage</option>
              <option value="sessionStorage">Session Storage</option>
            </Select>
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
      </Card.Body>
    </Card>
  );
};

export default ContainerSettings;
