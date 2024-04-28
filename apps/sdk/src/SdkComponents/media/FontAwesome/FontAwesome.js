// Packages
import React from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

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
