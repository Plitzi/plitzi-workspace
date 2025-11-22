/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type VideoProps = {
  ref?: RefObject<HTMLElement>;
  src?: string;
  autoPlay?: boolean;
  playsInline?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  internalProps: InternalPropsSTG2;
};

const Video = ({
  ref,
  src = '',
  autoPlay = false,
  playsInline = false,
  loop = false,
  muted = true,
  className = '',
  internalProps
}: VideoProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  if (!previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={clsx('plitzi-component__video video--edit-mode', className)}
      >
        <video src={src} autoPlay={autoPlay} playsInline={playsInline} loop={loop} muted={muted}>
          <track kind="captions" />
        </video>
      </RootElement>
    );
  }

  return (
    <RootElement
      tag="video"
      draggable={false}
      ref={ref}
      internalProps={internalProps}
      className={clsx('plitzi-component__video', className)}
      src={src}
      autoPlay={autoPlay}
      playsInline={playsInline}
      loop={loop}
      muted={muted}
    />
  );
};

export default withElement(Video);

export { Video };
