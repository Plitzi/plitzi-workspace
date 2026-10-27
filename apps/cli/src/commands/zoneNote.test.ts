import { describe, expect, it } from 'vitest';

import { zoneNote } from './visit';

// encore-14: a scout measured at Lisbon in October (UTC+0), where "Tomorrow 17:39 · 16:39 UTC" reads in its short form.
describe('the zone a page is read in', () => {
  it('is said when it is at UTC’s own time then — never when it is not', () => {
    const october = new Date('2026-10-27T15:00:00Z');
    const july = new Date('2026-07-01T15:00:00Z');

    expect(zoneNote('Europe/Lisbon', october)).toContain("Europe/Lisbon is at UTC's own time now");
    expect(zoneNote('UTC', october)).toContain('--timezone America/New_York');
    expect(zoneNote('Europe/Lisbon', july)).toBeUndefined();
    expect(zoneNote('America/Mexico_City', october)).toBeUndefined();
  });
});
