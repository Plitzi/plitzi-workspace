// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import { emptyObject } from '../../../helpers/utils';

const Button = forwardRef((props, ref) => {
  const {
    className = '',
    internalProps = emptyObject,
    children = undefined,
    contentPlacement = 'after',
    content: contentProp = 'Button',
    subType = 'button',
    disabled = false
  } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const content = useMemo(() => (!contentProp ? 'Button' : contentProp), [contentProp]);
  const buttonName = useMemo(() => {
    if (content) {
      return content;
    }

    return get(internalProps, 'definition.label', '');
  }, [internalProps]);

  return (
    <RootElement
      ref={ref}
      tag="button"
      type={previewMode ? subType : 'button'}
      internalProps={internalProps}
      className={classNames('plitzi-component__button', className, {
        'container--empty--skip': !previewMode && !children && content
      })}
      disabled={disabled}
      aria-label={buttonName}
    >
      {contentPlacement === 'before' && content}
      {children}
      {contentPlacement === 'after' && content}
    </RootElement>
  );
});

Button.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  children: PropTypes.node,
  contentPlacement: PropTypes.oneOf(['before', 'after', 'elements']),
  content: PropTypes.string,
  subType: PropTypes.oneOf(['button', 'reset', 'submit']),
  disabled: PropTypes.bool
};

export default withElement(Button);

export { Button };
