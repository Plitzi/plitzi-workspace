import { omit } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { createElement } from 'react';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';

import { hastText } from './hastText';
import { SyntaxHighlighter } from './syntaxHighlighter';
import CodeBlock from '../components/CodeBlock';

import type { MarkdownClassNames, MarkdownPart } from './markdownParts';
import type { ComponentProps } from 'react';
import type { Components, ExtraProps } from 'react-markdown';

export type MarkdownComponentsOptions = {
  classNames: MarkdownClassNames;
  headingLinks: boolean;
  wrapLines: boolean;
  showLineNumbers: boolean;
};

type Heading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
type Tagged =
  | 'p'
  | 'a'
  | 'strong'
  | 'em'
  | 'ul'
  | 'ol'
  | 'li'
  | 'blockquote'
  | 'hr'
  | 'img'
  | 'table'
  | 'thead'
  | 'tr'
  | 'th'
  | 'td';

const HEADING_PARTS: Record<Heading, MarkdownPart> = {
  h1: 'heading1',
  h2: 'heading2',
  h3: 'heading3',
  h4: 'heading4',
  h5: 'heading5',
  h6: 'heading6'
};

const LANGUAGE = /language-(\w+)/;

/** A tag as Markdown writes it, with the class of its part beside whatever class it already has. */
const tagged =
  <Tag extends Tagged>(tag: Tag, partClass: string | undefined) =>
  // `node` is react-markdown's own syntax-tree node, not an attribute: spread onto a tag it reaches the HTML as
  // `node="[object Object]"`.
  ({ className, ...rest }: ComponentProps<Tag> & ExtraProps) =>
    createElement(tag, { ...omit(rest, ['node']), className: clsx(className, partClass) || undefined });

/** A heading — and, when it has an id and links are wanted, a link to itself before its words. */
const heading =
  (Tag: Heading, { classNames, headingLinks }: MarkdownComponentsOptions) =>
  ({ children, node, className, ...rest }: ComponentProps<Heading> & ExtraProps) => (
    <Tag {...rest} className={clsx(className, classNames.heading, classNames[HEADING_PARTS[Tag]]) || undefined}>
      {headingLinks && rest.id && (
        <a
          className={clsx('anchor', classNames.anchor)}
          href={`#${rest.id}`}
          aria-label={`Link to “${node ? hastText(node) : rest.id}”`}
        >
          <span className="octicon octicon-link" aria-hidden="true" />
        </a>
      )}
      {children}
    </Tag>
  );

/** What each tag of a Markdown source is written as: its parts' classes, the headings' links and the code blocks. */
export const markdownComponents = (options: MarkdownComponentsOptions): Components => {
  const { classNames, wrapLines, showLineNumbers } = options;

  /** A fenced block, with its language and a copy button over it; any other `pre` stays as it is. */
  const Pre = ({ children, node, className, ...rest }: ComponentProps<'pre'> & ExtraProps) => {
    const pre = (
      <pre {...rest} className={clsx(className, classNames.codeBlock) || undefined}>
        {children}
      </pre>
    );
    const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code');
    if (!code || code.type !== 'element') {
      return pre;
    }

    const codeClassNames = code.properties.className;
    const language = Array.isArray(codeClassNames)
      ? codeClassNames
          .map(String)
          .map(name => LANGUAGE.exec(name)?.[1])
          .find(Boolean)
      : undefined;

    return (
      <CodeBlock language={language} code={hastText(code).replace(/\n$/, '')} classNames={classNames}>
        {pre}
      </CodeBlock>
    );
  };

  const Code = ({ children, className, ...rest }: ComponentProps<'code'> & ExtraProps) => {
    const attributes = omit(rest, ['node']);
    const match = LANGUAGE.exec(className || '');
    // The block's own attributes stay with the `pre` around it: the highlighter draws only its text.
    if (match) {
      return (
        <SyntaxHighlighter
          PreTag="div"
          language={match[1]}
          style={vscDarkPlus}
          wrapLines={wrapLines}
          showLineNumbers={showLineNumbers}
          children={typeof children === 'string' ? children.replace(/\n$/, '') : ''}
        />
      );
    }

    return (
      <code {...attributes} className={clsx(className, classNames.code) || undefined}>
        {children}
      </code>
    );
  };

  return {
    h1: heading('h1', options),
    h2: heading('h2', options),
    h3: heading('h3', options),
    h4: heading('h4', options),
    h5: heading('h5', options),
    h6: heading('h6', options),
    p: tagged('p', classNames.paragraph),
    a: tagged('a', classNames.link),
    strong: tagged('strong', classNames.strong),
    em: tagged('em', classNames.emphasis),
    ul: tagged('ul', classNames.list),
    ol: tagged('ol', classNames.list),
    li: tagged('li', classNames.listItem),
    blockquote: tagged('blockquote', classNames.quote),
    hr: tagged('hr', classNames.divider),
    img: tagged('img', classNames.image),
    table: tagged('table', classNames.table),
    thead: tagged('thead', classNames.tableHead),
    tr: tagged('tr', classNames.tableRow),
    th: tagged('th', classNames.tableHeaderCell),
    td: tagged('td', classNames.tableCell),
    pre: Pre,
    code: Code
  };
};
