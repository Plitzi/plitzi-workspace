import clsx from 'clsx';

import AvatarFace, { avatarHue } from './AvatarFace';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type AvatarProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  /** Their picture. Empty, or one that does not load, and their initials are shown — their outline with no name. */
  src?: string;
  /**
   * Who it is: their initials and their colour are drawn from it, and it is what a screen reader says — `{{
   * auth.details.username }}` for the visitor's own, a row's author in a list.
   */
  name?: string;
  /** Beside their name already — a byline, a member row — so a screen reader does not say it twice. */
  decorative?: boolean;
};

/** A person: their picture, or their initials on a colour of their own, in a round box. */
const Avatar = ({ ref, className = '', src = '', name = '', decorative = false }: AvatarProps) => {
  const {
    definition: { styleSelectors }
  } = useElement();
  const said = !decorative && name ? { role: 'img', 'aria-label': name } : { 'aria-hidden': true };

  return (
    <RootElement
      tag="span"
      ref={ref}
      className={clsx('plitzi-component__avatar', className)}
      style={avatarHue(name)}
      {...said}
    >
      <AvatarFace src={src} name={name} imageClassName={styleSelectors.image} />
    </RootElement>
  );
};

export default withElement(Avatar);

export { Avatar };
