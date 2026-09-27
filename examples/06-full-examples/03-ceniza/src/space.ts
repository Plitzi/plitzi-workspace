import { carta } from './pages/carta.ts';
import { degustacion } from './pages/degustacion.ts';
import { articulo, diario } from './pages/diario.ts';
import { eventos } from './pages/eventos.ts';
import { inicio } from './pages/inicio.ts';
import { nosotros } from './pages/nosotros.ts';
import { regalar } from './pages/regalar.ts';
import { reservas } from './pages/reservas.ts';
import { vinos } from './pages/vinos.ts';
import { classes, customCss, elements, fonts, variables } from './theme.ts';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * Ceniza, declared: nine pages and the journal's article page, one palette in two schemes, and the classes they share.
 *
 * Element ids, selector names and the flow chains are derived from what is written here, so authoring it twice
 * writes byte-identical documents. Pages live in `src/pages`, the shared frame in `src/layout.ts`, the copy in
 * `src/content.ts` and the look in `src/theme.ts`.
 */
export const space: SpaceSpec = {
  name: 'Ceniza',
  permanentUrl: 'ceniza',
  mode: 'desktop-first',
  theme: { default: 'system', schemes: ['light', 'dark'] },
  fonts,
  variables,
  elements,
  classes,
  customCss,
  /**
   * The journal's providers are resolved on the server (`runtime: 'server'`), and a space has to opt in for the
   * server to resolve them at all: without this every provider renders empty, with nothing reported anywhere.
   */
  rsc: { enabled: true },
  pages: [inicio, carta, degustacion, vinos, nosotros, eventos, regalar, reservas, diario, articulo]
};
