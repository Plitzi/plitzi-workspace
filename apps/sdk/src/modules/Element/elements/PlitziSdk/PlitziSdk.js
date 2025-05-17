// Packages
import React, { use } from 'react';
import classNames from 'classnames';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import RootElement from '@plitzi/sdk-elements/RootElement';
import withElement from '@plitzi/sdk-elements/withElement';

// Alias
import { RENDER_MODE_WIDGET } from '@modules/Sdk';

// Relatives
import App from '../../../../App';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   className: string;
 *   spaceKey: string;
 *   environment: string;
 * }} props
 * @returns {React.ReactElement}
 */
const PlitziSdk = props => {
  const { ref, internalProps = emptyObject, className = '', spaceKey = '', environment = 'main' } = props;
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
          renderMode={RENDER_MODE_WIDGET}
          server={server}
          className="h-full w-full"
        />
      )}
    </RootElement>
  );
};

export default withElement(PlitziSdk);

export { PlitziSdk };
