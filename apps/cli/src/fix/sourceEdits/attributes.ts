import { literalText, one, writtenNodeAt } from './ast';
import { sourceEdit } from './keys';

import type { EditOutcome, Ts } from './ast';
import type { WrittenPosition } from '@plitzi/sdk-authoring';
import type TypeScript from 'typescript';

/**
 * An attribute's words edited where a call writes them.
 */

/** The call written at that position, as it is written: what `plitzi element where` shows of an element. */
export const callTextAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): string | undefined => writtenNodeAt(ts, sourceFile, position)?.getText(sourceFile);

/**
 * Words handed first, before the props, are the content (`heading(title, { … })`): a `content` added to the props
 * would win over them and leave them written for nothing, so they are what an edit of the content changes.
 */
export const wordsOf = (ts: Ts, call: TypeScript.CallExpression): TypeScript.Expression | undefined => {
  const first = call.arguments.at(0);
  const second = call.arguments.at(1);
  if (!first || ts.isObjectLiteralExpression(first) || ts.isArrayLiteralExpression(first)) {
    return undefined;
  }

  return ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first) || second ? first : undefined;
};

/**
 * An attribute set — or removed, with no value — where the element was written: `plitzi element edit`. `content` written as the
 * factory's first argument (`text('Hi', { … })`) is replaced there; anything else is a key of its props, edited as a
 * fix edits it.
 */
export const attributeEdit = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  key: string,
  value: string | number | boolean | undefined
): EditOutcome => {
  const written = writtenNodeAt(ts, sourceFile, position);
  if (!written) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  const words = key === 'content' && ts.isCallExpression(written) ? wordsOf(ts, written) : undefined;
  if (words) {
    if (!ts.isStringLiteral(words) && !ts.isNoSubstitutionTemplateLiteral(words)) {
      return {
        unplaced: `\`content\` is written as \`${words.getText(sourceFile)}\` there: change it where that is given`
      };
    }

    if (value === undefined) {
      return { unplaced: '`content` is the call’s first argument there: remove it from the call by hand' };
    }

    return one({ start: words.getStart(sourceFile), end: words.getEnd(), text: literalText(value) });
  }

  return sourceEdit(
    ts,
    sourceFile,
    position,
    value === undefined ? { on: 'attribute', op: 'remove', key } : { on: 'attribute', op: 'set', key, value }
  );
};
