import { contentMoves } from '../advice/content';
import { flowStepIds } from '../flows';
import { fixSpace, lintSpace } from '../lint';
import { writtenAt, writtenAtPosition } from '../writtenAt';
import { SpaceAuthor } from './author';

import type { FixChange } from '../lint';
import type { AuthorSpaceOptions, ElementSpec, SpaceSpec } from '../types';
import type { WrittenPosition } from '../writtenAt';
import type { Schema, Style } from '@plitzi/sdk-shared';

/**
 * A fix's change as an edit of the source that wrote the element: the same change, on the props of the call that wrote
 * it — or on one of its steps, by the flow it is in and its place there.
 */
export interface SpecEdit extends Omit<FixChange, 'on'> {
  /** `children`: the children it holds — only its words and an icon — written as its own `content` and `icon`. */
  on: 'attribute' | 'field' | 'binding' | 'step' | 'children';
  /** For a step: which of the element's `flows`, and which step in it. */
  step?: { flow: number; index: number };
  /** For `children`: the icon's class, when one of them is an icon. */
  icon?: string;
  /** For `children`: where the icon goes, when it came after the words. */
  iconPlacement?: 'after';
}

/** One fix `fixSpace` would make, with where it was written and the edit that makes it there. */
export interface PlannedFix {
  code: string;
  message: string;
  elementId: string | null;
  /** Where the element was written: `src/space/pages/home.ts:42`. Absent for an element no factory wrote. */
  at?: string;
  /** The same place exactly — the factory's name, at its line and column — which is what the edit is made at. */
  position?: WrittenPosition;
  /** Absent when the fix has no one way to be written in the source — it is said, and left to the author. */
  edit?: SpecEdit;
}

const specEditOf = (change: FixChange, spec: ElementSpec): SpecEdit | undefined => {
  if (typeof change.on === 'string') {
    return { ...change, on: change.on };
  }

  const { step } = change.on;
  const flows = flowStepIds(spec.flows ?? []);
  for (const [flow, ids] of flows.entries()) {
    const index = ids.indexOf(step);
    if (index !== -1) {
      return { ...change, on: 'step', step: { flow, index } };
    }
  }

  // A step on the element that its own `flows` did not write — nothing in its source to edit.
  return undefined;
};

/** A problem the linter reports, by its code and the element it is on. */
export interface PlanProblem {
  code: string;
  elementId: string | null;
  message: string;
}

/** What is wrong with a declaration, and what of it has one fix. */
export interface FixPlan {
  /** Every problem the linter reports — errors and warnings alike, whether or not the space would be refused. */
  problems: PlanProblem[];
  fixes: PlannedFix[];
}

/**
 * What `fixSpace` would settle in this declaration, each with the place in the author's own code that wrote it and
 * the edit that makes the same fix there — what `plitzi space fix` shows, and writes when asked — beside every problem the
 * linter reports, which a written fix must not add to. The documents are written as `authorSpace` writes them,
 * without its gate: the problems a fix settles are the ones the gate stops on.
 */
export const planFixes = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): FixPlan => {
  const author = new SpaceAuthor(spec, options);
  const documents = author.write();
  const lint = lintSpace(documents, options);
  const problems = [...lint.errors, ...lint.warnings].map(issue => ({
    code: issue.code,
    elementId: issue.elementId ?? null,
    message: issue.message
  }));

  const fixes: PlannedFix[] = fixSpace(documents, options).applied.map(fix => {
    const written = fix.elementId === null ? undefined : author.specOf(fix.elementId);
    const at = written ? writtenAt(written) : undefined;
    const position = written ? writtenAtPosition(written) : undefined;
    const edit = written && fix.change ? specEditOf(fix.change, written) : undefined;

    return {
      code: fix.code,
      message: fix.message,
      elementId: fix.elementId,
      ...(at === undefined ? {} : { at }),
      ...(position === undefined ? {} : { position }),
      ...(edit === undefined ? {} : { edit })
    };
  });

  return { problems, fixes: [...fixes, ...contentFixes(author, documents)] };
};

/**
 * The `content-attribute` suggestions that have one way to be written: the children only words and an icon, none of
 * them named — a child with an id of its own is something a test or a flow may point at — and the words wearing no
 * class whose rules would have to be moved by hand.
 */
const contentFixes = (author: SpaceAuthor, documents: { schema: Schema; style: Style }): PlannedFix[] =>
  contentMoves(documents.schema, documents.style)
    .filter(move => !move.classed && move.children.every(child => author.specOf(child)?.id === undefined))
    .map(move => {
      const written = author.specOf(move.id);
      const at = written ? writtenAt(written) : undefined;
      const position = written ? writtenAtPosition(written) : undefined;
      const holds = move.icon === undefined ? 'its words' : move.words ? 'its words and an icon' : 'an icon';

      return {
        code: 'content-attribute',
        message: `"${move.id}" holds only ${holds} as elements: they are its own \`content\`${move.icon === undefined ? '' : ' and `icon`'}.`,
        elementId: move.id,
        ...(at === undefined ? {} : { at }),
        ...(position === undefined ? {} : { position }),
        edit: {
          on: 'children',
          op: 'set',
          key: 'content',
          value: move.words,
          ...(move.icon === undefined ? {} : { icon: move.icon }),
          ...(move.iconAfter ? { iconPlacement: 'after' } : {})
        }
      };
    });
