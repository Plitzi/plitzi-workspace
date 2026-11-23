import clsx from 'clsx';
import { useState } from 'react';

import { hueOf, initialsOf } from './faces';

import type { CSSProperties } from 'react';

export type AvatarFaceProps = {
  src?: string;
  name?: string;
  /** The class of its picture — the avatar element's `image` slot. */
  imageClassName?: string;
};

/**
 * A person's face inside an avatar's box: their picture, their initials when there is none or it does not load, and a
 * person's outline when there is not even a name. Never read itself: the box around it says who it is.
 */
const AvatarFace = ({ src = '', name = '', imageClassName }: AvatarFaceProps) => {
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const initials = initialsOf(name);

  if (src && failed !== src) {
    return (
      <img
        className={clsx('plitzi-component__avatar-image', imageClassName)}
        src={src}
        alt=""
        draggable={false}
        onError={() => setFailed(src)}
      />
    );
  }

  if (initials) {
    return <span className="plitzi-component__avatar-initials">{initials}</span>;
  }

  return (
    <svg className="plitzi-component__avatar-outline" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.5-8 5.5V21h16v-1.5c0-3-3.6-5.5-8-5.5Z" />
    </svg>
  );
};

/** The custom property a box carries its name's hue in, which the stylesheet colours it from. */
export const avatarHue = (name: string): CSSProperties => {
  const style: CSSProperties & Record<'--plitzi-avatar-hue', number> = { '--plitzi-avatar-hue': hueOf(name) };

  return style;
};

export default AvatarFace;
