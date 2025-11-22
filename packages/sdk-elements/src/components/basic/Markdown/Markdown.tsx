/* eslint-disable react-refresh/only-export-components */
import MarkdownUI from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type MarkdownProps = {
  ref: RefObject<HTMLElement>;
  internalProps: InternalPropsSTG2;
  className: string;
  content: string;
};

const Markdown = ({ ref, content = 'Markdown', className = '', internalProps }: MarkdownProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={clsx(
        'plitzi-component__markdown',
        { 'plitzi-component__markdown--edit-mode': !previewMode },
        className
      )}
    >
      <MarkdownUI>{content}</MarkdownUI>
    </RootElement>
  );
};

export default withElement(Markdown);

export { Markdown };
