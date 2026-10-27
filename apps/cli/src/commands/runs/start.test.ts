import { describe, expect, it } from 'vitest';

import { runNameOf } from './start';

describe('a run started with no name', () => {
  // A run's start was refused "name the run", its help saying the ask's first words name it.
  it('is named by its ask’s first words, as a run id takes them', () => {
    expect(runNameOf('Ronda de bugfixes y estabilidad: encuentra bugs reales')).toBe('ronda-de-bugfixes-y');
    expect(runNameOf('Añadir páginas al sitio')).toBe('anadir-paginas-al-sitio');
    expect(runNameOf('¿¿??')).toBeUndefined();
  });
});
