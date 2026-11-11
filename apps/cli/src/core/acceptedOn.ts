/**
 * What a refusal says when work breaks what approved tasks were accepted on — `task complete` of the task that breaks
 * them, and the finish on the run's whole result — written and read here alone: the run's findings read these refusals
 * back, and a finding that matched the finish's words as they once were missed every finish since.
 */

const BREAKS = 'breaks what approved tasks were accepted on';

const NOT_HOLDING = "accepted on does not hold on the run's whole result";

/** `task complete`'s head: the task completing, and each approved task's line it breaks. */
export const breaksApprovedText = (taskId: string, lines: readonly { task: string; said: string }[]): string =>
  `Task "${taskId}" ${BREAKS}: ${lines.map(line => `${line.task}: "${line.said}"`).join('; ')}`;

/** The finish's head: each approved task whose line fails on the run's whole result. */
export const notHoldingText = (lines: readonly { task: string; said: string }[]): string => {
  const tasks = [...new Set(lines.map(each => each.task))];

  return `What ${tasks.map(task => `"${task}"`).join(', ')} ${tasks.length === 1 ? 'was' : 'were'} ${NOT_HOLDING}: ${lines.map(each => `${each.task}: ${each.said}`).join('; ')}`;
};

/** The approved tasks a refusal says were broken — undefined when it is no such refusal. */
export const brokenNamedIn = (message: string): string[] | undefined => {
  if (message.includes(NOT_HOLDING)) {
    const head = message.slice(0, message.indexOf(NOT_HOLDING));

    return [...head.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  }

  if (message.includes(BREAKS)) {
    const lines = message.slice(message.indexOf(BREAKS) + BREAKS.length);

    return [...new Set([...lines.matchAll(/(?:^: |"; )([^\s:;"]+): "/g)].map(match => match[1]))];
  }

  return undefined;
};
