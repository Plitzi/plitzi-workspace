/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type FontAwesomeProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  icon?: string;
  size?: string;
  iconAnimation?: string;
};

const FontAwesome = ({
  ref,
  className = '',
  icon = 'fas fa-flag',
  size = 'fa-1x',
  iconAnimation = ''
}: FontAwesomeProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  if (!previewMode) {
    return (
      <RootElement ref={ref} className={clsx('plitzi-component__fontawesome fontawesome--edit-mode', className)}>
        <i className={clsx(icon, size, iconAnimation)} />
      </RootElement>
    );
  }

  return (
    <RootElement
      ref={ref}
      tag="i"
      className={clsx('plitzi-component__fontawesome', className, icon, size, iconAnimation)}
    />
  );
};

export default withElement(FontAwesome);

export { FontAwesome };
