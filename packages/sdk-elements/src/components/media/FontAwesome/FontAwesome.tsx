/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '../../../types/ElementTypes';
import type { RefObject } from 'react';

export type FontAwesomeProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalProps;
  icon: string;
  size: string;
  iconAnimation: string;
};

const FontAwesome = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps,
  icon = 'fas fa-flag',
  size = 'fa-1x',
  iconAnimation = ''
}: FontAwesomeProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  if (!previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={classNames('plitzi-component__fontawesome fontawesome--edit-mode', className)}
      >
        <i className={classNames(icon, size, iconAnimation)} />
      </RootElement>
    );
  }

  return (
    <RootElement
      ref={ref}
      tag="i"
      internalProps={internalProps}
      className={classNames('plitzi-component__fontawesome', className, icon, size, iconAnimation)}
    />
  );
};

export default withElement(FontAwesome);

export { FontAwesome };
