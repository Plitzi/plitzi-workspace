import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from '../../tests/helpers';
import { apply } from '../apply';
import { validate } from '../validate';

import type { Operation } from '../operations';

// What plitzi_validate answers is what plitzi_apply would do: an agent that validates first and then applies must
// never meet a refusal it was not shown. Both run the batch through `draftBatch`; these hold them to it.
const batches: Record<string, Operation[]> = {
  'a clean edit': [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { subType: 'section' } }],
  'an attribute the element never reads': [
    { type: 'patchElement', pageRef: 'home', ref: 'c1', props: { caption: 'Not read' } }
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

// An old issue on the element a batch changes is fixed on the way; the batch's own mistake, even of the same kind, is
// still refused — a fix must never swallow what the agent asked for.
describe('draftBatch — old issues fixed, new ones refused', () => {
  const withOldTypo = () => {
    const space = buildSpace();
    space.schema.flat.c1.attributes.caption = 'Never read';

    return space;
  };

  it('fixes an old issue on the element it changes, applies the batch, and says what it fixed', async () => {
    const result = await apply(
      {
        operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { subType: 'section' } }],
        dryRun: true
      },
      withOldTypo()
    );

    expect(result.errors ?? []).toEqual([]);
    expect(result.warnings?.some(warning => warning.startsWith('Fixed a pre-existing problem in element "c1"'))).toBe(
      true
    );
  });

  it('refuses the batch’s own mistake, of the same kind as the one it fixed', () => {
    const checked = validate(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { caption: 'Still not read' } }] },
      withOldTypo()
    );

    expect(checked.valid).toBe(false);
    expect(checked.errors.some(error => error.message.includes('"caption"'))).toBe(true);
  });
});

// A shorter way to the same page is said once, when the batch opens it up — never a refusal, and never again on the
// next batch that leaves it as it was.
describe('draftBatch — suggestions', () => {
  const labelledButton: Operation[] = [
    {
      type: 'upsertElement',
      pageRef: 'home',
      parentRef: 'c1',
      element: {
        ref: 'save',
        type: 'button',
        children: [{ ref: 'save-label', type: 'text', props: { content: 'Save' } }]
      }
    }
  ];

  it('says what the batch could have written shorter, in validate and in apply alike', async () => {
    const checked = validate({ operations: labelledButton }, buildSpace());
    const applied = await apply({ operations: labelledButton, dryRun: true }, buildSpace());

    expect(checked.valid).toBe(true);
    expect(checked.suggestions?.some(line => line.startsWith('[content-attribute]'))).toBe(true);
    expect(applied.suggestions).toEqual(checked.suggestions);
  });

  it('says nothing of what the space already held', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: labelledButton }, buildSpace(), cap.persisters);
    const checked = validate(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { subType: 'section' } }] },
      cap.saved()
    );

    expect(checked.suggestions ?? []).toEqual([]);
  });
});
