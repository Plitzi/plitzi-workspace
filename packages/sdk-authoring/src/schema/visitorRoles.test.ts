import { describe, expect, it } from 'vitest';

import { authorSpace } from './index';
import { specFromSpace } from '../decompile/specFromSpace';

import type { SpaceSpec } from './index';

/**
 * The roles a space's visitors may hold, and what each gives. A role written wrong is somebody who cannot do what they
 * were given, or can do what they were not — and neither shows anywhere — so authoring refuses rather than repairs.
 */

const space = (visitorRoles: unknown): SpaceSpec => ({
  name: 'Fieldnotes',
  permanentUrl: 'fieldnotes',
  // Some of these are written wrong on purpose, which the type would not allow.
  settings: { visitorRoles } as SpaceSpec['settings'],
  pages: [{ id: 'home', name: 'Home', slug: '', body: [] }]
});

describe('authorSpace / visitor roles', () => {
  it('writes each role and the permissions it gives into the settings', () => {
    const roles = { author: ['postPublish'], editor: ['postPublish', 'postEdit'] };
    const { schema, warnings } = authorSpace(space(roles));

    expect(schema.settings.visitorRoles).toEqual(roles);
    expect(warnings).toEqual([]);
  });

  it('refuses roles that are not a map of role to permissions', () => {
    expect(() => authorSpace(space(['author']))).toThrow(/Write each role with its permissions/u);
    expect(() => authorSpace(space({ author: 'postPublish' }))).toThrow(/as a list of names/u);
    expect(() => authorSpace(space({ author: [] }))).toThrow(/as a list of names/u);
  });

  it('refuses a name nobody could ask for', () => {
    expect(() => authorSpace(space({ 'post author': ['postPublish'] }))).toThrow(/A role is a name/u);
    expect(() => authorSpace(space({ author: ['post publish'] }))).toThrow(/not a permission name/u);
    expect(() => authorSpace(space({ author: ['postPublish', 'postPublish'] }))).toThrow(/twice/u);
  });

  it('keeps them through the Export', () => {
    const roles = { author: ['postPublish'] };
    const { spec, corrections } = specFromSpace(authorSpace(space(roles)));

    expect(corrections).toEqual([]);
    expect(spec.settings?.visitorRoles).toEqual(roles);
  });
});
