import clsx from 'clsx';
import { Fragment } from 'react';

import { MUTED } from '../../helpers';

export type IssueFixProps = {
  /** What to write instead, as the code table has it: Markdown whose `code` is in backticks. */
  fix: string;
  /** What leads it — a problem's fix, or a suggestion's short way. */
  label?: string;
};

/** Every other part of a text split on backticks is code: `a \`b\` c` is text, code, text. */
const partsOf = (fix: string): { text: string; code: boolean }[] =>
  fix.split('`').map((text, index) => ({ text, code: index % 2 === 1 }));

/**
 * What to write instead, under the problem it settles — the row the issue's code is filed under, so the panel says the
 * fix the authoring page and an agent over MCP are told, not one of its own.
 */
const IssueFix = ({ fix, label = 'Write instead' }: IssueFixProps) => (
  <p className={clsx('text-[11px] leading-relaxed', MUTED)}>
    <span className="font-medium">{label}: </span>
    {partsOf(fix).map((part, index) => (
      <Fragment key={index}>
        {part.code && (
          <code className="rounded bg-zinc-100 px-1 font-mono text-[11px] dark:bg-zinc-800">{part.text}</code>
        )}
        {!part.code && part.text}
      </Fragment>
    ))}
  </p>
);

export default IssueFix;
