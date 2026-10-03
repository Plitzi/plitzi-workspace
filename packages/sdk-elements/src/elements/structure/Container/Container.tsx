/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import { NAMEABLE_CONTAINER_TAGS } from './declaration';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type ContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?:
    | 'div'
    | 'header'
    | 'footer'
    | 'nav'
    | 'main'
    | 'section'
    | 'article'
    | 'aside'
    | 'address'
    | 'figure'
    | 'dl'
    | 'dt'
    | 'dd'
    // A row of a list, where the list's own items would bring a template they do not need.
    | 'li'
    // A heading made of parts — a word in another colour, an icon, a badge — which a `heading` cannot hold.
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    // Inline: a dot before a title, a word dressed apart — a container that sits in a line of text instead of breaking it.
    | 'span';
  /**
   * The name of the part of the page this is — "Main navigation", "Search results", "Your cart" — for screen readers
   * and browser agents, which list the page by its landmarks and regions and jump between them.
   *
   * Worth setting when a page has two of a kind (two `nav`s), and on a `section` that should be a region of its own. A
   * named `div` is announced as a group. Tags that take their name from what they hold (`li`, the headings) ignore it.
   */
  label?: string;
  /**
   * An illustration built out of elements — a mock of a page, a piece of art — left out of what screen readers and
   * browser agents read (`aria-hidden`), whatever it holds. Whatever it shows has to be reachable some other way: a
   * control inside it can still be tabbed to, and is then announced as nothing.
   */
  decorative?: boolean;
  children?: ReactNode;
};

const Container = ({
  ref,
  className = '',
  subType = 'div',
  label = '',
  decorative = false,
  children
}: ContainerProps) => {
  const named = !decorative && label && NAMEABLE_CONTAINER_TAGS.includes(subType);
  const name = named ? { 'aria-label': label, ...(subType === 'div' ? { role: 'group' } : {}) } : {};
  const hidden = decorative ? { 'aria-hidden': true } : {};

  return (
    <RootElement
      ref={ref}
      tag={subType}
      className={clsx(`plitzi-component__container plitzi-component__container-${subType}`, className)}
      {...name}
      {...hidden}
    >
      {children}
    </RootElement>
  );
};

export default withElement(Container);

export { Container };
