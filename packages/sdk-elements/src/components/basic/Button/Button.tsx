/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import get from 'lodash-es/get.js';
import { useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type ButtonProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  contentPlacement?: 'before' | 'after';
  content?: string;
  subType?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
};

const Button = ({
  ref,
  className = '',
  children,
  contentPlacement = 'after',
  content = 'Button',
  subType = 'button',
  disabled = false
}: ButtonProps) => {
  const internalProps = useElement();
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const buttonName = useMemo(() => {
    if (typeof content === 'string') {
      return content;
    }

    return get(internalProps, 'definition.label', '');
  }, [content, internalProps]);

  return (
    <RootElement
      ref={ref}
      tag="button"
      type={previewMode ? subType : 'button'}
      className={clsx('plitzi-component__button', className, {
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
