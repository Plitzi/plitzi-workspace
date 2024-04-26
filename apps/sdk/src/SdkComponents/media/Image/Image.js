// Packages
import React from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const Image = props => {
  const {
    ref,
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
};

export default withElement(Image);

export { Image };
