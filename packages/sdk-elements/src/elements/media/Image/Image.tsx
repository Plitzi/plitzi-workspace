/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { imageSrcSet, imageUrl, isResizableImage } from '@plitzi/sdk-shared/helpers/images';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import { getFallbackSVGBase64 } from './ImageHelper';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type ImageProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  src?: string;
  /**
   * What the picture shows, in words — read by screen readers and browser agents in its place, and shown when it
   * cannot load. Say what it is for on this page, not what file it is: "Maya presenting the roadmap", not "photo".
   */
  alt?: string;
  /**
   * A picture that adds nothing the words around it do not already say — a texture, an ornament, a photo beside a
   * caption that describes it. It is left out of what assistive technology reads (`alt=""`), whatever `alt` says,
   * and the linter stops asking for a description.
   */
  decorative?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  /** `auto` leaves the choice to the browser — what the builder offers first. */
  loadMode?: 'auto' | 'eager' | 'lazy';
  /**
   * How wide the picture is drawn, for the browser to pick a size by before the layout exists: `'100vw'`, or
   * `'(max-width: 48rem) 100vw, 360px'` for a card. Read when the page server resizes pictures (`images` in its
   * configuration) and the `src` is another site's.
   */
  sizes?: string;
  /** The picture's own width and height, in pixels (0 for not given): the browser keeps its space before it arrives,
   *  so nothing jumps. */
  width?: number;
  height?: number;
  /**
   * Whether the page server may make sizes of the picture, when it does (`images` in its configuration). `false` keeps
   * this one as it is — a picture already sized for where it sits, or one its host must serve itself. A vector (SVG) is
   * never resized.
   */
  resize?: boolean;
};

/** The size a resized picture falls back to, for a browser that reads no `srcset`. */
const FALLBACK_WIDTH = 1280;

/**
 * What an image draws when there is no picture to draw — none given yet, or the one given failed. Drawn from the SDK
 * itself, never fetched: a project with no network, or a page whose image is still waiting on its data, shows it
 * the same.
 */
const fallback = getFallbackSVGBase64();

const Image = ({
  ref,
  className = '',
  src: srcProp,
  alt: altProp = '',
  decorative = false,
  fetchPriority = 'auto',
  loadMode,
  sizes = '100vw',
  width,
  height,
  resize = true
}: ImageProps) => {
  const {
    settings: { previewMode }
  } = usePlitzi();

  /**
   * An empty `src` is an absent one.
   *
   * A default parameter only answers `undefined`, and a bound `src` whose source has not resolved is `''` — the
   * ordinary state of any image fed from an API. The browser treats `src=""` as "the current document", so it
   * re-requests the whole page to put it in an image, and React warns about exactly that.
   */
  const src = srcProp || fallback;
  const alt = decorative ? '' : altProp;

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

  // Another site's picture, resized by the page server when it says it does: the builder and a project with no page
  // server publish no endpoint, and keep the picture as it is.
  const [endpoint] = useCommonStore('images.endpoint');
  const resized =
    previewMode && endpoint && resize && !broken && isResizableImage(src)
      ? { src: imageUrl(endpoint, src, FALLBACK_WIDTH), srcSet: imageSrcSet(endpoint, src), sizes }
      : { src: shown };
  const dimensions = { ...(width ? { width } : {}), ...(height ? { height } : {}) };

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
      {...resized}
      {...dimensions}
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
