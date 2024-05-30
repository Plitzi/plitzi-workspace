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
 *   src: string;
 *   autoPlay: boolean;
 *   playsInline: boolean;
 *   loop: boolean;
 *   muted: boolean;
 *   className: string;
 *   internalProps: object;
 * }} props
 * @returns {React.ReactElement}
 */
const Video = props => {
  const {
    ref,
    src = '',
    autoPlay = false,
    playsInline = false,
    loop = false,
    muted = true,
    className = '',
    internalProps = emptyObject
  } = props;
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
