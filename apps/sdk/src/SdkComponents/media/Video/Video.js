// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const Video = forwardRef((props, ref) => {
  const {
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
});

Video.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string,
  src: PropTypes.string,
  autoPlay: PropTypes.bool,
  playsInline: PropTypes.bool,
  loop: PropTypes.bool,
  muted: PropTypes.bool
};

export default withElement(Video);

export { Video };
