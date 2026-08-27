import { isValidElementId } from '@plitzi/sdk-schema/helpers/elementId';

import type { ValidationCtx } from './context';

// Wider than the element-id charset (`isValidElementId`): this also covers refs that are NOT element names — a
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

// The name on a NEW element, which is stored verbatim as its id. Checked here so the whole batch reports at once;
// the handler re-checks at write time, where it also knows whether another element already answers to it.
export const checkIdRef = (ref: string, path: string, ctx: ValidationCtx): void => {
  checkRef(ref, path, ctx);
  if (ref && REF_RE.test(ref) && !isValidElementId(ref)) {
    ctx.errors.push({
      path,
      message: `"${ref}" is not a valid element name`,
      hint:
        'Use only letters, numbers, hyphens and underscores (e.g. "hero-cta" or "my_list_card"). The name IS the ' +
        'element id, which the runtime embeds in source names like `apiContainer_<id>.field` and in interaction ' +
        'targets — a dot would break those paths.'
    });
  }
};
