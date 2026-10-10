import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import RootElement from '@plitzi/sdk-elements/Element/RootElement';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import { offlineDocuments } from './offlineDocuments';
import App from '../../../../App';

import type { PlitziSdkAttributes } from '@plitzi/sdk-elements/elements/advanced/PlitziSdk/declaration';
import type { RefObject } from 'react';

export type PlitziSdkProps = PlitziSdkAttributes & {
  ref?: RefObject<HTMLElement>;
  className?: string;
};

const PlitziSdk = ({ ref, className, spaceKey, environment = 'main', offlineData }: PlitziSdkProps) => {
  const {
    settings: { previewMode }
  } = usePlitzi();
  const { server } = use(NetworkContext);
  const offline = useMemo(() => (offlineData === undefined ? undefined : offlineDocuments(offlineData)), [offlineData]);
  const problem = offline && 'problem' in offline ? offline.problem : undefined;
  const waiting = offline && 'waiting' in offline ? offline.waiting : undefined;
  const documents = offline && 'documents' in offline ? offline.documents : undefined;
  const ignoredKey = offline !== undefined && !!spaceKey;

  useEffect(() => {
    if (problem) {
      console.error(`[plitziSdk] ${problem}`);
    }
  }, [problem]);

  useEffect(() => {
    if (ignoredKey) {
      console.warn('[plitziSdk] Both `offlineData` and `spaceKey` are set: the documents are drawn, the key is not.');
    }
  }, [ignoredKey]);

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__plitzi-sdk', className, { 'with__plitzi-sdk': !previewMode })}
    >
      {documents && (
        <App
          offlineMode
          offlineData={documents}
          environment={environment}
          renderMode="widget"
          className="h-full w-full"
        />
      )}
      {!offline && spaceKey && (
        <App
          webKey={spaceKey}
          environment={environment}
          server={server}
          renderMode="widget"
          className="h-full w-full"
        />
      )}
      {problem && !previewMode && <p className="plitzi-sdk__problem">{problem}</p>}
      {waiting && !previewMode && (
        <p className="plitzi-sdk__waiting">
          Waiting for {waiting.map(part => `\`${part}\``).join(' and ')} to be bound.
        </p>
      )}
    </RootElement>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export default withElement(PlitziSdk);

export { PlitziSdk };
