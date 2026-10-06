/* eslint-disable react-refresh/only-export-components */
import MarkdownUI from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';
import { useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { uniqueAnchor } from '@plitzi/sdk-shared/schema/anchor';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { MarkdownClassNames } from '@plitzi/plitzi-ui/Markdown';
import type { RefObject } from 'react';

export type MarkdownProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  content?: string;
  /**
   * Whether a heading offers a link to itself (`a.anchor`) before its words. `false` leaves the link out and keeps the
   * heading's id, so `/page#its-words` still lands on it.
   */
  headingLinks?: boolean;
};

const Markdown = ({ ref, content = 'Markdown', className = '', headingLinks = true }: MarkdownProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const {
    definition: { styleSelectors }
  } = useElement();
  const { heading, paragraph, link, list, listItem, quote, code, codeBlock, image, table, anchor } = styleSelectors;
  // One object while the classes stay the same: a new one rebuilds every tag of the document.
  const classNames = useMemo<MarkdownClassNames>(
    () => ({ heading, paragraph, link, list, listItem, quote, code, codeBlock, image, table, anchor }),
    [heading, paragraph, link, list, listItem, quote, code, codeBlock, image, table, anchor]
  );

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
      <MarkdownUI headingAnchor={uniqueAnchor} headingLinks={headingLinks} classNames={classNames}>
        {content}
      </MarkdownUI>
    </RootElement>
  );
};

export default withElement(Markdown);

export { Markdown };
