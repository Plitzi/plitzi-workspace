/**
 * An element of your own (a plugin): authored from its declaration — the one `plitzi plugin add` writes — so a flow on
 * its events, a step to its actions and its attributes are all checked. Hand the declaration to `authorSpace` too.
 */
import {
  button,
  declaredCallback,
  declaredTrigger,
  defineElement,
  named,
  onClick,
  setState
} from '@plitzi/sdk-authoring';
import { definePlugin } from '@plitzi/sdk-authoring/plugin';

import type { PluginDeclarationData, SpaceSpec } from '@plitzi/sdk-authoring';

// In a project, `src/plugins/SeatPicker/declaration.ts` — `export default definePlugin<SeatPickerAttributes>()({ … })`.
const declaration = definePlugin<{ rows?: number }>()({
  type: 'seatPicker',
  label: 'Seat Picker',
  attributes: { rows: 10 },
  triggers: { onPick: { preview: { seat: '' } } },
  callbacks: { reset: {} }
});

const seatPicker = defineElement(declaration);

// `authorSpace(recipe, { plugins })` — in a project, every `src/plugins/<Name>/declaration.ts`, found by folder.
export const plugins: PluginDeclarationData[] = [declaration];

export const recipe: SpaceSpec = {
  name: 'Seats',
  permanentUrl: 'seats',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        seatPicker({
          id: 'seats',
          rows: 12,
          flows: [
            [
              named('picked', declaredTrigger(declaration, 'onPick')),
              setState({ key: 'seat', type: 'text', value: '{{ picked.seat }}' })
            ]
          ]
        }),
        button({ content: 'Clear', flows: [[onClick(), declaredCallback(declaration, 'reset', { on: 'seats' })]] })
      ]
    }
  ]
};
