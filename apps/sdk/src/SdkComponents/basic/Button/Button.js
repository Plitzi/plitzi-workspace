// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';

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
 *   children: React.ReactNode;
 *   contentPlacement: 'before' | 'after';
 *   content: React.ReactNode;
 *   subType: 'button' | 'submit' | 'reset';
 *   disabled: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const Button = props => {
  const {
    ref,
    className = '',
    internalProps = emptyObject,
    children,
    contentPlacement = 'after',
    content = 'Button',
    subType = 'button',
    disabled = false
  } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
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
};

export default withElement(Button);

export { Button };
