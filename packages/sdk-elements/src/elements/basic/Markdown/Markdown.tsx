/* eslint-disable react-refresh/only-export-components */
import MarkdownUI from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { uniqueAnchor } from '@plitzi/sdk-shared/schema/anchor';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type MarkdownProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  content?: string;
};

const Markdown = ({ ref, content = 'Markdown', className = '' }: MarkdownProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  return (
    <RootElement
      ref={ref}
      className={clsx(
        'plitzi-component__markdown',
        { 'plitzi-component__markdown--edit-mode': !previewMode },
        className
      )}
    >
      {/* Every heading is a section a link can name — `/page#its-words` — with the anchor authoring checks links against. */}
      <MarkdownUI headingAnchor={uniqueAnchor}>{content}</MarkdownUI>
    </RootElement>
  );
};

export default withElement(Markdown);

export { Markdown };
