import type { InheritData } from '../../../../helpers';
import type { StyleCategory } from '@plitzi/sdk-shared';

/** Where the value a row shows comes from — what the label's colour says, from strongest to weakest. */
export type LabelSource = 'binding' | 'variable' | 'value' | 'inherit' | 'none';

export type LabelFlags = {
  hasValues: boolean;
  hasInherit: boolean;
  hasBinding: boolean;
  hasVariables: boolean;
};

export const labelSource = ({ hasValues, hasInherit, hasBinding, hasVariables }: LabelFlags): LabelSource => {
  if (hasBinding) {
    return 'binding';
  }

  if (hasVariables) {
    return 'variable';
  }

  if (hasValues) {
    return 'value';
  }

  if (hasInherit) {
    return 'inherit';
  }

  return 'none';
};

const SOURCE_TEXT: Record<Exclude<LabelSource, 'none' | 'inherit'>, string> = {
  binding: 'Bound to data',
  variable: 'Set on this selector, from a token',
  value: 'Set on this selector'
};

/**
 * What hovering the label tells: where its value comes from, and — when a value is set here — that a click clears it (a
 * binding alone is not, and the label does not promise it). An inherited value names the selector and the breakpoint
 * it comes from, the same one the control shows.
 */
export const labelHint = (
  source: LabelSource,
  resettable: boolean,
  keys: StyleCategory[] | undefined,
  inheritData: InheritData['style'] | undefined
): string | undefined => {
  if (source === 'none') {
    return undefined;
  }

  if (source === 'inherit') {
    const origin = keys?.map(key => inheritData?.[key]?.[0]).find(entry => entry !== undefined);
    if (!origin) {
      return 'Inherited';
    }

    return `Inherited from ${origin.key} (${origin.displayMode}): ${String(origin.value)}`;
  }

  if (!resettable) {
    return SOURCE_TEXT[source];
  }

  return `${SOURCE_TEXT[source]} — click to reset`;
};
