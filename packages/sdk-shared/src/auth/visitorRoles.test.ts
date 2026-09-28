import { describe, expect, it } from 'vitest';

import { checkVisitorRoles, visitorAccess } from './visitorRoles';

describe('checkVisitorRoles', () => {
  it('reads a map of role to permissions', () => {
    expect(checkVisitorRoles({ author: ['postPublish'] })).toEqual({ ok: true, roles: { author: ['postPublish'] } });
  });

  it('says what is wrong, in a way that can be fixed', () => {
    const problem = (value: unknown) => {
      const checked = checkVisitorRoles(value);

      return checked.ok ? '' : checked.problem;
    };

    expect(problem(['author'])).toMatch(/Write each role with its permissions/u);
    expect(problem({ 'post author': ['x'] })).toMatch(/A role is a name/u);
    expect(problem({ author: [] })).toMatch(/as a list of names/u);
    expect(problem({ author: ['post publish'] })).toMatch(/not a permission name/u);
    expect(problem({ author: ['a', 'a'] })).toMatch(/twice/u);
  });
});

/** A visitor holds exactly what the space's roles give — never more, and nothing for a role it no longer declares. */
describe('visitorAccess', () => {
  const declared = { author: ['postPublish'], editor: ['postPublish', 'postEdit'] };

  it('gives the permissions of every role held, once', () => {
    expect(visitorAccess(declared, ['author', 'editor'])).toEqual({
      roles: ['author', 'editor'],
      permissions: ['postPublish', 'postEdit']
    });
  });

  it('gives nothing for a role the space no longer declares', () => {
    expect(visitorAccess(declared, ['moderator'])).toEqual({ roles: [], permissions: [] });
  });

  it('gives nothing where the roles are missing or written wrong', () => {
    expect(visitorAccess(undefined, ['author'])).toEqual({ roles: [], permissions: [] });
    expect(visitorAccess({ author: 'postPublish' }, ['author'])).toEqual({ roles: [], permissions: [] });
    // `toString` is on every object's prototype: a role name must be the space's own, not inherited.
    expect(visitorAccess(declared, ['toString'])).toEqual({ roles: [], permissions: [] });
  });
});
