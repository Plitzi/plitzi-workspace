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

const Image = forwardRef((props, ref) => {
  const {
    internalProps = emptyObject,
    className = '',
    src = 'https://cdn.plitzi.com/resources/img/placeholder-img.svg',
    alt = '',
    loadMode = 'auto'
  } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  if (!previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={classNames('plitzi-component__image image--edit-mode', className)}
      >
        <img draggable={false} src={src} alt={alt} loading={loadMode} />
      </RootElement>
    );
  }

  return (
    <RootElement
      tag="img"
      draggable={false}
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__image', className)}
      src={src}
      alt={alt}
      loading={loadMode}
    />
  );
});

Image.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string,
  src: PropTypes.string,
  alt: PropTypes.string,
  loadMode: PropTypes.string
};

export default withElement(Image);

export { Image };
