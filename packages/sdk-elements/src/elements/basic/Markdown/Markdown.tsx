/* eslint-disable react-refresh/only-export-components */
import MarkdownUI from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type MarkdownProps = {
  id: string;
  ref: RefObject<HTMLElement>;
  className: string;
  content: string;
};

const Markdown = ({ id, ref, content = 'Markdown', className = '' }: MarkdownProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  return (
    <RootElement
      id={id}
      ref={ref}
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
