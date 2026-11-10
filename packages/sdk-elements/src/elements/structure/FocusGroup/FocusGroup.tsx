import clsx from 'clsx';
import { useCallback } from 'react';

import { arrowTarget, isArrowKey } from './arrowFocus';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { KeyboardEvent, ReactNode, RefObject } from 'react';

export type FocusGroupProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: 'div' | 'nav' | 'section';
  /**
   * What the controls inside are, for screen readers and browser agents — "Search results", "Filters" — announced as a
   * group (a `nav` or a `section` as that landmark).
   */
  label?: string;
  children?: ReactNode;
};

/**
 * A box whose controls the arrow keys move through — a search palette's results, a menu, a set of options: ↑ and ↓
 * through them, ← and → to the first of the next or the previous list, Home and End to the ends. From a text field
 * inside it, ↓ goes down into them (the other arrows stay the caret's) and ↑ from the first comes back.
 */
const FocusGroup = ({ ref, className = '', subType = 'div', label = '', children }: FocusGroupProps) => {
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!isArrowKey(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    // `target` is typed as an EventTarget: a key press inside an element comes from an element.
    const target = arrowTarget(event.currentTarget, event.target as Element, event.key);
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  const name = label ? { 'aria-label': label, ...(subType === 'div' ? { role: 'group' } : {}) } : {};

  return (
    <RootElement
      ref={ref}
      tag={subType}
      className={clsx('plitzi-component__focus-group', className)}
      onKeyDown={handleKeyDown}
      {...name}
    >
      {children}
    </RootElement>
  );
};

export default withElement(FocusGroup);

export { FocusGroup };
