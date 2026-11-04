import clsx from 'clsx';
import { useMemo } from 'react';
// Its `Markdown`: a function of its options to the document's elements, with no hooks — called, its result is kept.
import markdownTree from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { keptByText } from './helpers/keptByText';
import { markdownComponents } from './helpers/markdownComponents';
import { rehypeHeadingAnchors } from './helpers/rehypeHeadingAnchors';

import type { MarkdownClassNames } from './helpers/markdownParts';
import type { HeadingAnchor } from './helpers/rehypeHeadingAnchors';
import type { ReactElement } from 'react';

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
   * — the parts are `MARKDOWN_PARTS`. The output carries no stylesheet of its own beyond the code blocks' highlighting:
   * the SDK's base layer gives an undressed document its type (`_document.scss`), below every class.
   * Keep it the same object from one render to the next: a new one rebuilds every tag of the document.
   */
  classNames?: MarkdownClassNames;
};

const NO_CLASS_NAMES: MarkdownClassNames = {};

const remarkPlugins = [remarkGfm];

/**
 * The documents made from a source with the options that shape them, kept by both: parsing (micromark, mdast, hast) and
 * turning the tree into elements was a page of prose's largest cost, and it is the same on every render of the page.
 * React elements are values, handed again to every render that asks for the same; the components in them run as ever.
 */
const documents = keptByText<ReactElement>(512 * 1024);

/** A number for each heading-anchor function, so two documents keyed alike were given their ids alike. */
const anchors = new WeakMap<HeadingAnchor, number>();
let anchorsNumbered = 0;

const anchorKey = (anchor: HeadingAnchor | undefined): string => {
  if (!anchor) {
    return '';
  }

  let id = anchors.get(anchor);
  if (id === undefined) {
    anchorsNumbered += 1;
    id = anchorsNumbered;
    anchors.set(anchor, id);
  }

  return String(id);
};

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
  const document = useMemo(() => {
    // The classes by their names, not the object: a hook makes a new one for each element that renders a document.
    const key = [
      anchorKey(headingAnchor),
      `${String(headingLinks)},${String(wrapLines)},${String(showLineNumbers)}`,
      JSON.stringify(Object.entries(classNames).sort(([a], [b]) => a.localeCompare(b))),
      children
    ].join('\u0000');
    const known = documents.get(key);
    if (known) {
      return known;
    }

    const made = markdownTree({
      remarkPlugins,
      rehypePlugins: headingAnchor ? [rehypeHeadingAnchors(headingAnchor)] : [],
      components: markdownComponents({ classNames, headingLinks, wrapLines, showLineNumbers }),
      children
    });
    documents.set(key, made);

    return made;
  }, [children, classNames, headingAnchor, headingLinks, wrapLines, showLineNumbers]);

  return <div className={clsx('markdown', className)}>{document}</div>;
};

export default MarkdownDocument;
