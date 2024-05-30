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
 *   className: string;
 *   internalProps: object;
 *   icon: string;
 *   size: string;
 *   iconAnimation: string;
 * }} props
 * @returns {React.ReactElement}
 */
const FontAwesome = props => {
  const {
    ref,
    className = '',
    internalProps = emptyObject,
    icon = 'fas fa-flag',
    size = 'fa-1x',
    iconAnimation = ''
  } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  if (!previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={classNames('plitzi-component__fontawesome fontawesome--edit-mode', className)}
      >
        <i className={classNames(icon, size, iconAnimation)} />
      </RootElement>
    );
  }

  return (
    <RootElement
      ref={ref}
      tag="i"
      internalProps={internalProps}
      className={classNames('plitzi-component__fontawesome', className, icon, size, iconAnimation)}
    />
  );
};

export default withElement(FontAwesome);

export { FontAwesome };
