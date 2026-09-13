export interface RedirectPolicyConfig {
  /** Where a destination that is missing, malformed or not ours goes instead. Its own origin is always allowed. */
  defaultRedirect: string;
  /** Absolute targets a caller may name, compared by origin. */
  allowedRedirects?: string[];
}

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * Vet a caller-supplied landing page against a deployment's policy: the target itself when it is ours, the default when
 * it is not.
 *
 * Every flow that takes a `?redirect=` somebody else wrote and later navigates to it — social sign-in, the shared
 * sign-in screen's way out, a confirmation mail that has to bring somebody back — asks THIS, built once from the same
 * configuration. Two implementations of "is this target ours" is how one of them ends up accepting `//evil.com`.
 *
 * A relative path stays on the host that navigates to it and is allowed; a protocol-relative (`//evil.com`) or
 * backslash (`/\evil.com`) one reads as a path and navigates off-site, and is not.
 */
export const createRedirectPolicy = (config: RedirectPolicyConfig): ((target: unknown) => string) => {
  const fallback = config.defaultRedirect;
  const allowed = [fallback, ...(config.allowedRedirects ?? [])]
    .map(originOf)
    .filter((value): value is string => value !== null);

  return (target: unknown): string => {
    if (typeof target !== 'string' || target === '') {
      return fallback;
    }

    if (target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')) {
      return target;
    }

    const origin = originOf(target);

    return origin && allowed.includes(origin) ? target : fallback;
  };
};
