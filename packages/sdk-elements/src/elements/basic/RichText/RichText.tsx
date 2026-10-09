/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useMemo } from 'react';

import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';

import { classHtmlParts } from './classHtmlParts';
import { rebaseHtmlMedia, sanitizeHtml } from './sanitizeHtml';
import MarkdownDocument from '../../../components/MarkdownDocument';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import useMarkdownClassNames from '../Markdown/hooks/useMarkdownClassNames';

import type { RefObject } from 'react';

export type RichTextProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  /** The body, bound from the provider. Whatever shape the CMS returns — see `format`. */
  content?: string;
  /** CMSs disagree on this and each one is right for itself: Strapi returns HTML or markdown depending on the
   *  editor, Contentful and Ghost return HTML, and plenty of fields are just text. One element, three readings. */
  format?: 'html' | 'markdown' | 'text';
  /** Prefix for relative `src`/`href` inside the body. A connector rebases record fields, but the markup inside a
   *  body field is opaque to it. */
  mediaBaseUrl?: string;
};

const RichText = ({ ref, className = '', content = '', format = 'html', mediaBaseUrl = '' }: RichTextProps) => {
  const {
    settings: { previewMode }
  } = usePlitzi();
  const {
    definition: { styleSelectors }
  } = useElement();
  const classNames = useMarkdownClassNames(styleSelectors);

  const html = useMemo(() => {
    if (format !== 'html') {
      return '';
    }

    return classHtmlParts(rebaseHtmlMedia(sanitizeHtml(content), mediaBaseUrl), classNames);
  }, [format, content, mediaBaseUrl, classNames]);

  return (
    <RootElement
      ref={ref}
      className={clsx(
        'plitzi-component__rich-text',
        { 'plitzi-component__rich-text--edit-mode': !previewMode },
        className
      )}
    >
      {format === 'html' && <div dangerouslySetInnerHTML={{ __html: html }} />}
      {format === 'markdown' && <MarkdownDocument classNames={classNames}>{content}</MarkdownDocument>}
      {format === 'text' && <div className="plitzi-component__rich-text-plain">{content}</div>}
    </RootElement>
  );
};

export default withElement(RichText);

export { RichText };
