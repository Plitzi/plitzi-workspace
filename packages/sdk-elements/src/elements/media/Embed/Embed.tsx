/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { embeddableSrc } from './embeddableSrc';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type EmbedProps = {
  ref?: RefObject<HTMLElement>;
  /** The page shown: an `https:` address, or a path of this site. Anything else is not loaded. */
  src?: string;
  /** What the frame shows, in words — what a screen reader announces for it. */
  title?: string;
  loading?: 'lazy' | 'eager';
  /** The features the page inside may use: `fullscreen; clipboard-write`. */
  allow?: string;
  /** Restrictions on the page inside — `allow-scripts allow-same-origin` — or nothing, for none. */
  sandbox?: string;
  referrerPolicy?: 'no-referrer' | 'origin' | 'strict-origin-when-cross-origin' | 'no-referrer-when-downgrade';
  className?: string;
};

const Embed = ({
  ref,
  src = '',
  title = '',
  loading = 'lazy',
  allow = '',
  sandbox,
  referrerPolicy = 'strict-origin-when-cross-origin',
  className = ''
}: EmbedProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const address = embeddableSrc(src);
  const frame = {
    src: address,
    title,
    loading,
    referrerPolicy,
    ...(allow ? { allow } : {}),
    ...(sandbox === undefined ? {} : { sandbox })
  };

  // In the builder the page inside would take every click; the element is selected through a cover over it.
  if (!previewMode) {
    return (
      <RootElement ref={ref} className={clsx('plitzi-component__embed embed--edit-mode', className)}>
        {address && <iframe {...frame} />}
        <div className="embed__cover" />
      </RootElement>
    );
  }

  return <RootElement tag="iframe" ref={ref} className={clsx('plitzi-component__embed', className)} {...frame} />;
};

export default withElement(Embed);

export { Embed };
