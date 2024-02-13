// Packages
import React, { forwardRef, useContext } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import { RENDER_MODE_WIDGET } from '@modules/Sdk';
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import App from '../../../App';
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import { emptyObject } from '../../../helpers/utils';

const PlitziSdk = forwardRef((props, ref) => {
  const { internalProps = emptyObject, className = '', spaceKey = '', environment = 'main' } = props;
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
});

PlitziSdk.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string,
  spaceId: PropTypes.string,
  spaceKey: PropTypes.string,
  environment: PropTypes.string
};

export default withElement(PlitziSdk);

export { PlitziSdk };
