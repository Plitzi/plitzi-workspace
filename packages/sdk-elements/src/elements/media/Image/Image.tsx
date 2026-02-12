/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { getFallbackSVGBase64 } from './ImageHelper';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject, SyntheticEvent } from 'react';

export type ImageProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  src?: string;
  alt?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  loadMode?: 'eager' | 'lazy';
};

const fallback = getFallbackSVGBase64();

const Image = ({
  ref,
  className = '',
  src = 'https://cdn.plitzi.com/resources/img/placeholder-img.svg',
  alt = '',
  fetchPriority = 'auto',
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
      <RootElement ref={ref} className={clsx('plitzi-component__image image--edit-mode', className)}>
        <img
          draggable={false}
          src={src}
          alt={alt}
          loading={loadMode}
          fetchPriority={fetchPriority}
          onError={handleError}
        />
      </RootElement>
    );
  }

  return (
    <RootElement
      tag="img"
      draggable={false}
      ref={ref}
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
