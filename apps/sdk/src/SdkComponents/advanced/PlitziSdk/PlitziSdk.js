// Packages
import React, { useContext } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import { RENDER_MODE_WIDGET } from '@modules/Sdk';
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import App from '../../../App';
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const PlitziSdk = props => {
  const { ref, internalProps = emptyObject, className = '', spaceKey = '', environment = 'main' } = props;
  const {
    settings: { previewMode },
    contexts: { NetworkContext }
  } = usePlitziServiceContext();
  const { server } = useContext(NetworkContext);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__plitzi-sdk', className, { 'with__plitzi-sdk': !previewMode })}
    >
      <App
        webKey={spaceKey}
        environment={environment}
        renderMode={RENDER_MODE_WIDGET}
        server={server}
        className="h-full w-full"
      />
    </RootElement>
  );
};

export default withElement(PlitziSdk);

export { PlitziSdk };
