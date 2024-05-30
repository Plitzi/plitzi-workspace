// Packages
import React from 'react';
import classNames from 'classnames';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement';
import withElement from '../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   className: string;
 *   src: string;
 *   alt: string;
 *   loadMode: 'auto' | 'eager' | 'lazy';
 * }} props
 * @returns {React.ReactElement}
 */
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
