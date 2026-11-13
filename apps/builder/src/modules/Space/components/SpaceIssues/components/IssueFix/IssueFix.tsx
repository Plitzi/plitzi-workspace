import clsx from 'clsx';

import { MUTED } from '../../helpers';
import CodeText from '../CodeText';

export type IssueFixProps = {
  /** What to write instead, as the code table has it: Markdown whose `code` is in backticks. */
  fix: string;
  /** What leads it — a problem's fix, or a suggestion's short way. */
  label?: string;
};

/**
 * What to write instead, under the problem it settles — the row the issue's code is filed under, so the panel says the
 * fix the authoring page and an agent over MCP are told, not one of its own.
 */
const IssueFix = ({ fix, label = 'Write instead' }: IssueFixProps) => (
  <p className={clsx('text-[11px] leading-relaxed', MUTED)}>
    <span className="font-medium">{label}: </span>
    <CodeText text={fix} />
  </p>
);

export default IssueFix;
