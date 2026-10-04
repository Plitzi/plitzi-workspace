import { describe, expect, it } from 'vitest';

import { explainResource } from './explain';

describe('plitzi://explain', () => {
  it('explains a name the way the CLI prints it', () => {
    const read = explainResource('plitzi://explain/navigate');

    expect('text' in read && read.text).toContain('Written: navigate({ … })');
  });

  it('lists a kind by its plural', () => {
    const read = explainResource('plitzi://explain/codes');

    expect('names' in read && read.names.map(entry => entry.name)).toContain('class-and-css');
  });

  it('says what there is to ask about when a name is nothing', () => {
    expect(() => explainResource('plitzi://explain/teleport')).toThrow('plitzi://explain/steps');
  });
});
