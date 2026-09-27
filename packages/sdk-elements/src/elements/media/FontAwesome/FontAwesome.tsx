/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type FontAwesomeProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  icon?: string;
  size?: string;
  iconAnimation?: string;
  /**
   * What the icon means, for an icon that says something on its own — a status, a rating, a warning with no words
   * beside it. Left empty, the icon is decoration and is hidden from screen readers and browser agents: a glyph from
   * an icon font reads as a private-use character, which is noise at best. An icon inside a button or a link is named
   * by that button or link (its text or its `title`), never here.
   */
  label?: string;
};

const FontAwesome = ({
  ref,
  className = '',
  icon = 'fas fa-flag',
  size = 'fa-1x',
  iconAnimation = '',
  label = ''
}: FontAwesomeProps) => {
  const meaning = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };

  return (
    <RootElement
      ref={ref}
      tag="i"
      className={clsx('plitzi-component__fontawesome', className, icon, size, iconAnimation)}
      {...meaning}
    />
  );
};

export default withElement(FontAwesome);

export { FontAwesome };
