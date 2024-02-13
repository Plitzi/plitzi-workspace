// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import { emptyObject } from '../../../helpers/utils';

const FontAwesome = forwardRef((props, ref) => {
  const {
    className = '',
    internalProps = emptyObject,
    icon = 'fas fa-flag',
    size = 'fa-1x',
    iconAnimation = ''
  } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  if (!previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={classNames('plitzi-component__fontawesome fontawesome--edit-mode', className)}
      >
        <i className={classNames(icon, size, iconAnimation)} />
      </RootElement>
    );
  }

  return (
    <RootElement
      ref={ref}
      tag="i"
      internalProps={internalProps}
      className={classNames('plitzi-component__fontawesome', className, icon, size, iconAnimation)}
    />
  );
});

FontAwesome.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  icon: PropTypes.string,
  size: PropTypes.string,
  iconAnimation: PropTypes.string
};

export default withElement(FontAwesome);

export { FontAwesome };
