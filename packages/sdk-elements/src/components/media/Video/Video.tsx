/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type VideoProps = {
  ref?: RefObject<HTMLElement>;
  src?: string;
  autoPlay?: boolean;
  playsInline?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  internalProps?: InternalProps;
};

const Video = ({
  ref,
  src = '',
  autoPlay = false,
  playsInline = false,
  loop = false,
  muted = true,
  className = '',
  internalProps = emptyObject as InternalProps
}: VideoProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  if (!previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={classNames('plitzi-component__video video--edit-mode', className)}
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
      className={classNames('plitzi-component__video', className)}
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
