import { hasTemplateSyntax, inspectTemplate } from '@plitzi/sdk-shared/helpers/twigWrapper';

/**
 * What is wrong with a template as it is being typed, in the words the linter uses on the saved space — or nothing.
 *
 * The runtime skips what it cannot read and renders a value nobody wrote, so the editor says so while the text is
 * still in front of whoever wrote it, rather than after a save puts it in the problems list. Only the syntax: which
 * names are in scope depends on where the template lands, and that is the saved-space check's to answer.
 */
export const templateProblem = (value: unknown): string | undefined => {
  if (!hasTemplateSyntax(value)) {
    return undefined;
  }

  const { issues } = inspectTemplate(value as string);

  return issues.length > 0
    ? `This template cannot be read as written — ${issues.join('; ')}. It would render something other than what it says.`
    : undefined;
};
