import { describe, expect, it } from 'vitest';

import { buildSpace } from '../../tests/helpers';
import { apply } from '../apply';
import { validate } from '../validate';

import type { Operation } from '../operations';

// What plitzi_validate answers is what plitzi_apply would do: an agent that validates first and then applies must
// never meet a refusal it was not shown. Both run the batch through `draftBatch`; these hold them to it.
const batches: Record<string, Operation[]> = {
  'a clean edit': [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { subType: 'section' } }],
  'an attribute the element never reads': [
    { type: 'patchElement', pageRef: 'home', ref: 'c1', props: { title: 'Not read' } }
  ],
  'a flow that does not start with its trigger': [
    {
      type: 'upsertInteractionFlow',
      pageRef: 'home',
      ref: 'c1',
      nodes: [{ nodeType: 'globalCallback', action: 'addNotification', title: 'Notify', params: { content: 'Hi' } }]
    }
  ],
  'a page that does not exist': [{ type: 'deleteElement', pageRef: 'ghost', ref: 'c1' }]
};

describe('draftBatch — validate and apply agree', () => {
  for (const [name, operations] of Object.entries(batches)) {
    it(name, async () => {
      const checked = validate({ operations }, buildSpace());
      const applied = await apply({ operations, dryRun: true }, buildSpace());

      expect(applied.errors ?? []).toEqual(checked.errors);
      expect(checked.valid).toBe((applied.errors ?? []).length === 0);
    });
  }
});
