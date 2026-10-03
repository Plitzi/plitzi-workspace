import type { Formatter } from '../commands/projectFormatter';

/**
 * The edited text formatted as the project formats it — when the file was formatted that way before the edit. One the
 * project does not keep formatted is written as it is, so the change is the edit and nothing else.
 */
export const formatLikeBefore = async (
  format: Formatter,
  file: string,
  before: string,
  after: string
): Promise<string> => {
  try {
    return (await format(file, before)) === before ? await format(file, after) : after;
  } catch {
    return after;
  }
};
