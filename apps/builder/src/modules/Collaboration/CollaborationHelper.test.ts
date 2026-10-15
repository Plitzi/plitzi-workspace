import { describe, expect, it } from 'vitest';

import { collaboratorTitle } from './CollaborationHelper';

describe('collaboratorTitle', () => {
  it('names a person by their name', () => {
    expect(collaboratorTitle({ user: { firstName: 'ana', surName: '' } })).toBe('ana');
  });

  it('names an agent by its application and whom it works for', () => {
    expect(collaboratorTitle({ user: { firstName: 'Claude', surName: '' }, agent: { for: 'ana' } })).toBe(
      'Claude · for ana'
    );
    expect(collaboratorTitle({ user: { firstName: 'Claude', surName: '' }, agent: { for: '' } })).toBe(
      'Claude · for a member'
    );
  });
});
