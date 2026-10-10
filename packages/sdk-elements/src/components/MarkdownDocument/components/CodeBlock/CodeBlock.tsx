import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';

import { copyText, NOT_COPIED_REASON } from '@plitzi/sdk-shared/helpers/clipboard';

import type { MarkdownClassNames } from '../../helpers/markdownParts';
import type { ReactNode } from 'react';

export type CodeBlockProps = {
  /** The language the block is written in, as its fence named it. */
  language?: string;
  /** The block's text, as it is copied. */
  code: string;
  /** The classes of the frame's parts — `codeBlockFrame`, `codeBlockHeader`, `codeBlockLanguage`, `codeBlockCopy`. */
  classNames: MarkdownClassNames;
  children?: ReactNode;
};

/** How long "Copied" — or "Not copied" — stays before the button reads "Copy" again. */
const COPIED_MS = 2000;

const LABELS = { idle: 'Copy', copied: 'Copied', refused: 'Not copied' } as const;

/** A fenced block with what it is written in and a way to take it: a header over the code itself. */
const CodeBlock = ({ language, code, classNames, children }: CodeBlockProps) => {
  const [copy, setCopy] = useState<keyof typeof LABELS>('idle');

  useEffect(() => {
    if (copy === 'idle') {
      return undefined;
    }

    const timer = setTimeout(() => setCopy('idle'), COPIED_MS);

    return () => clearTimeout(timer);
  }, [copy]);

  const handleCopy = useCallback(() => {
    void copyText(code).then(copied => setCopy(copied ? 'copied' : 'refused'));
  }, [code]);

  return (
    <div className={clsx('markdown-code', classNames.codeBlockFrame)} data-language={language}>
      <div className={clsx('markdown-code-header', classNames.codeBlockHeader)}>
        <span className={clsx('markdown-code-language', classNames.codeBlockLanguage)}>{language ?? 'text'}</span>
        <button
          type="button"
          className={clsx('markdown-code-copy', classNames.codeBlockCopy)}
          onClick={handleCopy}
          aria-live="polite"
          title={copy === 'refused' ? NOT_COPIED_REASON : undefined}
        >
          {LABELS[copy]}
        </button>
      </div>
      {children}
    </div>
  );
};

export default CodeBlock;
