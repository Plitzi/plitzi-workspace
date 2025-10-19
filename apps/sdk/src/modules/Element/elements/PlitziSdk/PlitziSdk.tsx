import classNames from 'classnames';
import { use } from 'react';

import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import RootElement from '@plitzi/sdk-elements/Element/RootElement';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import App from '../../../../App';

import type { Environment, InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type PlitziSdkProps = {
  ref?: RefObject<HTMLElement>;
  internalProps?: InternalPropsSTG2;
  className?: string;
  spaceKey?: string;
  environment?: Environment;
};

const PlitziSdk = ({ ref, internalProps, className, spaceKey, environment = 'main' }: PlitziSdkProps) => {
  const {
    settings: { previewMode },
    contexts: { NetworkContext }
  } = usePlitziServiceContext();
  const { server } = use(NetworkContext);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__plitzi-sdk', className, { 'with__plitzi-sdk': !previewMode })}
    >
      {spaceKey && (
        <App
          webKey={spaceKey}
          environment={environment}
          renderMode="widget"
          server={server}
          className="h-full w-full"
        />
      )}
    </RootElement>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export default withElement(PlitziSdk);

export { PlitziSdk };
