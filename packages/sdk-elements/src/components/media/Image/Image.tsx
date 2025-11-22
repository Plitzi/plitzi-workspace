/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { getFallbackSVGBase64 } from './ImageHelper';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject, SyntheticEvent } from 'react';

export type ImageProps = {
  ref?: RefObject<HTMLElement>;
  internalProps: InternalPropsSTG2;
  className?: string;
  src?: string;
  alt?: string;
  loadMode?: 'eager' | 'lazy';
};

const fallback = getFallbackSVGBase64();

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

  const handleError = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = fallback;
  }, []);

  if (!previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={clsx('plitzi-component__image image--edit-mode', className)}
      >
        <img draggable={false} src={src} alt={alt} loading={loadMode} onError={handleError} />
      </RootElement>
    );
  }

  return (
    <RootElement
      tag="img"
      draggable={false}
      ref={ref}
      internalProps={internalProps}
      className={clsx('plitzi-component__image', className)}
      src={src}
      alt={alt}
      loading={loadMode}
      onError={handleError}
    />
  );
};

export default withElement(Image);

export { Image };
