import { isValidIdRef } from '@plitzi/sdk-schema/helpers/idRef';

import type { ValidationCtx } from './context';

// Wider than the idRef charset (`isValidIdRef`): this also covers refs that are NOT idRefs — a raw element id, a
// style class ref, a componentType, a variable name.
export const REF_RE = /^[a-zA-Z0-9._-]+$/;

export const checkRef = (ref: string, path: string, ctx: ValidationCtx): void => {
  if (!ref || ref.trim().length === 0) {
    ctx.errors.push({ path, message: 'Ref must not be empty', hint: 'Use a semantic name like "hero.title"' });

    return;
  }

  if (!REF_RE.test(ref)) {
    ctx.errors.push({
      path,
      message: `Ref "${ref}" has invalid characters`,
      hint: 'Allowed characters: letters, numbers, dot, hyphen, underscore'
    });
  }
};

// A ref on a NEW element, which is stored verbatim as its idRef. Checked here so the whole batch reports at once;
// the handler re-checks at write time, where it also knows the ref is not already taken by another element.
export const checkIdRef = (ref: string, path: string, ctx: ValidationCtx): void => {
  checkRef(ref, path, ctx);
  if (ref && REF_RE.test(ref) && !isValidIdRef(ref)) {
    ctx.errors.push({
      path,
      message: `Ref "${ref}" is not a valid idRef`,
      hint:
        'Use only letters, numbers, hyphens and underscores (e.g. "hero-cta" or "my_list_card"). This ref becomes ' +
        'the element idRef, which the runtime embeds in source names like `apiContainer_<idRef>.field` and in ' +
        'interaction targets — a dot would break those paths.'
    });
  }
};
