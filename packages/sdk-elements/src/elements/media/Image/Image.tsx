/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { getFallbackSVGBase64 } from './ImageHelper';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type ImageProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  src?: string;
  alt?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  /** `auto` leaves the choice to the browser — what the builder offers first. */
  loadMode?: 'auto' | 'eager' | 'lazy';
};

const fallback = getFallbackSVGBase64();

const PLACEHOLDER = 'https://cdn.plitzi.com/resources/img/placeholder-img.svg';

const Image = ({ ref, className = '', src: srcProp, alt = '', fetchPriority = 'auto', loadMode }: ImageProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  /**
   * An empty `src` is an absent one.
   *
   * A default parameter only answers `undefined`, and a bound `src` whose source has not resolved is `''` — the
   * ordinary state of any image fed from an API. The browser treats `src=""` as "the current document", so it
   * re-requests the whole page to put it in an image, and React warns about exactly that.
   */
  const src = srcProp || PLACEHOLDER;

  /**
   * The source that failed, so the fallback is drawn in its place — and SAID to be.
   *
   * State rather than a write to the node: the fallback is a picture that loads, so to the browser a broken image and
   * a working one look the same, and `data-plitzi-failed` is the only thing on the page that tells them apart — for a
   * test checking every image arrived, and for whoever is looking at a grey box wondering why. Keyed by the source, so
   * a new `src` gets its own attempt and the marker goes with the old one.
   */
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const broken = failed === src;
  const handleError = useCallback(() => setFailed(src), [src]);
  const shown = broken ? fallback : src;
  const marker = broken ? { 'data-plitzi-failed': src } : {};

  // `auto` is the browser's own choice, which is what leaving the attribute out asks for.
  const loading = loadMode === 'auto' ? undefined : loadMode;

  if (!previewMode) {
    return (
      <RootElement ref={ref} className={clsx('plitzi-component__image image--edit-mode', className)}>
        <img
          draggable={false}
          src={shown}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          onError={broken ? undefined : handleError}
          {...marker}
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
      src={shown}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      onError={broken ? undefined : handleError}
      {...marker}
    />
  );
};

export default withElement(Image);

export { Image };
