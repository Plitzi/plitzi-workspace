import { Fragment } from 'react';

import { partsOf } from '../../helpers';

export type CodeTextProps = {
  /** Markdown whose `code` is in backticks, as the linter and the code table write it. */
  text: string;
};

/** A message or a fix with the code in it set apart, so `display: flex` reads as code and not as a sentence. */
const CodeText = ({ text }: CodeTextProps) =>
  partsOf(text).map((part, index) => (
    <Fragment key={index}>
      {part.code && (
        <code className="bg-ui-raised rounded px-1 font-mono text-[11px] [overflow-wrap:anywhere]">{part.text}</code>
      )}
      {!part.code && part.text}
    </Fragment>
  ));

export default CodeText;
