/**
 * A space's visitor roles (`settings.visitorRoles`): each role a signed-in visitor may hold there, with the permissions
 * it gives — what an action's `access: 'role'` and a page's `can()` are answered from.
 *
 * One reading of them for everyone who handles them: authoring refuses a space that writes them wrong, the builder's
 * save refuses the same, and the server that resolves a visitor never reads a malformed map as a grant.
 */

export type VisitorRoles = Record<string, string[]>;

/** A role or a permission: a name a person reads in the builder and an action names in its access rule. */
export const VISITOR_NAME = /^[A-Za-z][\w-]{0,63}$/;

const EXAMPLE = '`visitorRoles: { author: ["postPublish"], editor: ["postPublish", "postEdit"] }`';

/** The roles as declared, or what is wrong with them — said so it can be fixed from the message alone. */
export const checkVisitorRoles = (
  value: unknown
): { ok: true; roles: VisitorRoles } | { ok: false; problem: string } => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false,
      problem: `\`settings.visitorRoles\` is ${JSON.stringify(value)}. Write each role with its permissions: ${EXAMPLE}.`
    };
  }

  const roles: VisitorRoles = {};
  for (const [role, permissions] of Object.entries(value)) {
    if (!VISITOR_NAME.test(role)) {
      return {
        ok: false,
        problem: `\`settings.visitorRoles\` has the role "${role}". A role is a name — a letter, then letters, digits, \`-\` or \`_\` — like "author".`
      };
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return {
        ok: false,
        problem: `\`settings.visitorRoles.${role}\` is ${JSON.stringify(permissions)}. A role is the permissions it gives, as a list of names: ${EXAMPLE}.`
      };
    }

    const seen = new Set<string>();
    for (const permission of permissions as unknown[]) {
      if (typeof permission !== 'string' || !VISITOR_NAME.test(permission)) {
        return {
          ok: false,
          problem: `\`settings.visitorRoles.${role}\` has ${JSON.stringify(permission)}, which is not a permission name. Name it the way an action's \`access: 'role'\` asks for it, like "postPublish".`
        };
      }

      if (seen.has(permission)) {
        return { ok: false, problem: `\`settings.visitorRoles.${role}\` names "${permission}" twice.` };
      }

      seen.add(permission);
    }

    roles[role] = [...seen];
  }

  return { ok: true, roles };
};

/**
 * What a visitor holding `held` may do in a space that declares `declared`: the roles the space still declares, and
 * every permission they give. A role the space no longer declares gives nothing — a grant outlives an edit of the
 * roles, and must not outlive what it meant. Malformed roles give nothing at all.
 */
export const visitorAccess = (
  declared: unknown,
  held: readonly string[]
): { roles: string[]; permissions: string[] } => {
  const checked = declared === undefined ? undefined : checkVisitorRoles(declared);
  if (!checked?.ok) {
    return { roles: [], permissions: [] };
  }

  const roles = [...new Set(held)].filter(role => Object.hasOwn(checked.roles, role));

  return { roles, permissions: [...new Set(roles.flatMap(role => checked.roles[role]))] };
};
