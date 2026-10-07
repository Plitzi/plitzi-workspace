import clsx from 'clsx';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { markdownComponents } from './helpers/markdownComponents';
import { rehypeHeadingAnchors } from './helpers/rehypeHeadingAnchors';

import type { MarkdownClassNames } from './helpers/markdownParts';
import type { HeadingAnchor } from './helpers/rehypeHeadingAnchors';

export type MarkdownDocumentProps = {
  className?: string;
  children?: string;
  wrapLines?: boolean;
  showLineNumbers?: boolean;
  /**
   * The id each heading carries, so `#id` lands on it — asked once per heading, in order, with the ids already given.
   * Without it a heading carries none and offers no link to itself.
   */
  headingAnchor?: HeadingAnchor;
  /**
   * Whether a heading that has an id offers a link to itself (`a.anchor`) before its words. `false` keeps the ids — a
   * `#id` still lands on the heading — and leaves the link out.
   */
  headingLinks?: boolean;
  /**
   * A class for each part of the output, beside the one it already has: `{ heading: 'doc-heading', link: 'doc-link' }`
   * — the parts are `MARKDOWN_PARTS`. The output carries no style of its own beyond the code blocks' highlighting.
   * Keep it the same object from one render to the next: a new one rebuilds every tag of the document.
   */
  classNames?: MarkdownClassNames;
};

const NO_CLASS_NAMES: MarkdownClassNames = {};

const remarkPlugins = [remarkGfm];

/**
 * A Markdown source (GitHub-flavoured) as HTML, inside a `div.markdown`, each part of it with the class the consumer
 * gives it — the SDK's own copy of plitzi-ui's `Markdown`, which ships GitHub's stylesheet for a library's consumers:
 * here the space dresses every part, and a stylesheet of its own would win over what the space writes.
 */
const MarkdownDocument = ({
  className,
  children = '',
  wrapLines = true,
  showLineNumbers = true,
  headingAnchor,
  headingLinks = true,
  classNames = NO_CLASS_NAMES
}: MarkdownDocumentProps) => {
  const rehypePlugins = useMemo(() => (headingAnchor ? [rehypeHeadingAnchors(headingAnchor)] : []), [headingAnchor]);
  const components = useMemo(
    () => markdownComponents({ classNames, headingLinks, wrapLines, showLineNumbers }),
    [classNames, headingLinks, wrapLines, showLineNumbers]
  );

  return (
    <div className={clsx('markdown', className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownDocument;
