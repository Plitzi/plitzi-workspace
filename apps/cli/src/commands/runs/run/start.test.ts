import { describe, expect, it } from 'vitest';

import { freeRunName, runNameOf } from './start';

describe('a run started with no name', () => {
  // A run's start was refused "name the run", its help saying the ask's first words name it.
  it('is named by its ask’s first words, as a run id takes them', () => {
    expect(runNameOf('Ronda de bugfixes y estabilidad: encuentra bugs reales')).toBe('ronda-de-bugfixes-y');
    expect(runNameOf('Añadir páginas al sitio')).toBe('anadir-paginas-al-sitio');
    expect(runNameOf('¿¿??')).toBeUndefined();
  });
});

// A second run asked in the same first words was refused as the first's: "give this plan a runId of its own".
describe('the name a run starts on', () => {
  it('is the ask’s, else with a number after it, the first no run had', async () => {
    const taken = new Set(['find-and-fix-what', 'find-and-fix-what-2']);
    const has = (id: string) => Promise.resolve(taken.has(id));

    expect(await freeRunName('find-and-fix-what', has)).toBe('find-and-fix-what-3');
    expect(await freeRunName('translate-the-site', has)).toBe('translate-the-site');
  });
});
