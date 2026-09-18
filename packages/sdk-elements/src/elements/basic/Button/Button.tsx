/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
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
  /**
   * For a button that shows and hides something — a menu, an answer, a panel: `true` while that is open.
   *
   * Left out, the button claims to control nothing, which is not the same as `false` ("it controls something, and it
   * is closed"). A screen reader announces the difference, so an ordinary button must not get a default here.
   */
  ariaExpanded?: boolean;
  /** For a button that stays on or off — a filter, a mode: `true` while it is on. Left out, it is a plain button. */
  ariaPressed?: boolean;
  /**
   * What the button does, in words — shown as a tooltip on hover, and the button's accessible name when it has no text
   * of its own. An icon-only button without one is announced as nothing at all.
   */
  title?: string;
};

const Button = ({
  ref,
  className = '',
  children,
  contentPlacement = 'after',
  content = 'Button',
  subType = 'button',
  disabled = false,
  ariaExpanded,
  ariaPressed,
  title
}: ButtonProps) => {
  const {
    definition: { label }
  } = useElement();
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const buttonName = useMemo(
    () => (typeof content === 'string' && content ? content : title || label),
    [content, title, label]
  );

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
      title={title || undefined}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
    >
      {contentPlacement === 'before' && content}
      {children}
      {contentPlacement === 'after' && content}
    </RootElement>
  );
};

export default withElement(Button);

export { Button };
