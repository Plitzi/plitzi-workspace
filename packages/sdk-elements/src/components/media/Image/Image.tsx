/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type ImageProps = {
  ref?: RefObject<HTMLElement>;
  internalProps: InternalPropsSTG2;
  className?: string;
  src?: string;
  alt?: string;
  loadMode?: 'eager' | 'lazy';
};

const Image = ({
  ref,
  internalProps,
  className = '',
  src = 'https://cdn.plitzi.com/resources/img/placeholder-img.svg',
  alt = '',
  loadMode
}: ImageProps) => {
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
