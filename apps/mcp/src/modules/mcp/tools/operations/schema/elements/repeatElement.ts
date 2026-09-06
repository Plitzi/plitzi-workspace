import { z } from 'zod';

import { elementInput, elementShape, position, styleRefs } from '../shared';

import type { ValidationError } from '../../../../types';
import type { ElementInput } from '../shared';

// A row's data: whatever fields the template names, as plain JSON.
const item = z.record(z.string(), z.unknown());

// Enough rows for a real list, few enough that one call cannot explode the batch (each row expands to the whole
// template subtree, and the batch's own MAX_OPS cannot see inside a single op). MAX_ROWS bounds their product once
// a nested repeat is in play — 100 rows of 100 sub-rows would be 10.000 elements from two lines of JSON.
const MAX_ITEMS = 100;
const MAX_ROWS = 500;

/** An element of the template. Same shape as any element, plus the one thing only a template may carry: `repeat`,
 *  which turns the node into a wrapper whose children are a sub-template rendered once per entry of a list living
 *  in the current row. */
export interface TemplateElement {
  ref: string;
  type: string;
  label?: string;
  subType?: string;
  props?: Record<string, unknown>;
  style?: { base?: string[]; slots?: Record<string, string[]> };
  initialState?: { styleVariant?: Record<string, Record<string, string | string[]>>; visibility?: boolean };
  children?: TemplateElement[];
  /** The sub-template is a PLAIN element tree: one level of nesting, no repeat inside a repeat inside a repeat.
   *  That is also what keeps the op expressible as JSON Schema — a template that could nest itself without limit
   *  makes the tool schema infinitely recursive, and a host that reads it blows its stack. */
  repeat?: { items: string; template: ElementInput };
}

const templateElement: z.ZodType<TemplateElement> = z.lazy(() =>
  z.object({
    ...elementShape,
    children: z.array(templateElement).optional(),
    repeat: z
      .object({
        items: z
          .string()
          .describe('The row field holding the sub-list, as "{{item.<field>}}" (or just the field path)'),
        template: elementInput.describe('Rendered once per entry of that sub-list (a plain element tree)')
      })
      .optional()
      .describe('Makes THIS element the wrapper of a nested list — a list inside each row')
  })
);

export const repeatElementOp = z
  .object({
    type: z.literal('repeatElement'),
    pageRef: z.string().describe('The page, by name'),
    ref: z.string().describe('Ref of the WRAPPER element this creates; the rows become its children'),
    elementType: z.string().optional().describe('Type of the wrapper; defaults to container'),
    label: z.string().optional(),
    style: styleRefs.optional().describe('Classes for the wrapper — this is where the row/grid layout goes'),
    parentRef: z.string().optional().describe('Anchor ref/id; defaults to page root'),
    position: position.optional(),
    template: templateElement.describe('The subtree ONE row renders, with {{item.field}} placeholders'),
    items: z
      .array(item)
      .min(1)
      .max(MAX_ITEMS)
      .describe('One object per row; its fields fill the {{item.field}} placeholders of the template')
  })
  .describe(
    'Build a LIST from one template plus its `items` data, instead of repeating near-identical elements. Creates ' +
      'a wrapper whose children are the template rendered once per row. `{{item.<field>}}` is replaced by that ' +
      'row field — alone as the whole value it keeps the field type, mixed with text it interpolates. Every ref ' +
      'gets the row number appended ("day" → "day-1"), which is how you address a row later. A template node may ' +
      'carry `repeat: { items: "{{item.<list>}}", template: … }` to nest a list inside each row: it becomes the ' +
      'sub-list wrapper, refs number both levels ("step-2-3"), and `{{item.…}}` there reads the SUB-row. Other ' +
      '{{…}} names are untouched, so schema variables still work.'
  );

export type RepeatElement = z.infer<typeof repeatElementOp>;

const PLACEHOLDER = /\{\{\s*item\.([A-Za-z0-9_.-]+)\s*\}\}/g;
const WHOLE_PLACEHOLDER = /^\{\{\s*item\.([A-Za-z0-9_.-]+)\s*\}\}$/;

type Row = Record<string, unknown>;

// Dotted lookup into a row, so `{{item.author.name}}` reads a nested field.
const lookup = (row: Row, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') {
      return undefined;
    }

    return (value as Row)[key];
  }, row);

type Fill = { value: unknown; missing?: string };

/** One string of the template, with its placeholders resolved. A placeholder that IS the whole string yields the
 *  field's own value (a number stays a number, an array stays an array); mixed text interpolates. */
const fillString = (text: string, row: Row): Fill => {
  const whole = WHOLE_PLACEHOLDER.exec(text);
  if (whole) {
    const value = lookup(row, whole[1]);

    return value === undefined ? { value: text, missing: whole[1] } : { value };
  }

  let missing: string | undefined;
  const value = text.replace(PLACEHOLDER, (match, path: string) => {
    const found = lookup(row, path);
    if (found === undefined) {
      missing ??= path;

      return match;
    }

    if (typeof found === 'string') {
      return found;
    }

    return typeof found === 'number' || typeof found === 'boolean' ? found.toString() : JSON.stringify(found);
  });

  return missing === undefined ? { value } : { value, missing };
};

// Deep-fills any JSON the template carries (props, style refs, interaction params…), collecting the fields the row
// does not have so the whole batch can be refused with a message naming them.
const fillValue = (value: unknown, row: Row, missing: Set<string>): unknown => {
  if (typeof value === 'string') {
    const filled = fillString(value, row);
    if (filled.missing) {
      missing.add(filled.missing);
    }

    return filled.value;
  }

  if (Array.isArray(value)) {
    return value.map(entry => fillValue(entry, row, missing));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Row).map(([key, entry]) => [key, fillValue(entry, row, missing)])
    );
  }

  return value;
};

/** What one row's expansion collects on the way: the fields it could not resolve, the sub-lists that were not
 *  lists, and how many rows it produced (the guard against a nested repeat exploding). */
interface Expansion {
  missing: Set<string>;
  notAList: Set<string>;
  rows: number;
}

// A nested repeat reads its sub-rows from the row it is expanding. Non-object entries are wrapped so a list of
// plain strings still works: `{{item.value}}` is then the entry itself.
const listOf = (row: Row, spec: string): Row[] | undefined => {
  const whole = WHOLE_PLACEHOLDER.exec(spec);
  const value = lookup(row, whole ? whole[1] : spec);
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.map(entry => (entry !== null && typeof entry === 'object' ? (entry as Row) : { value: entry }));
};

/** One template node against one row. `suffix` is the row numbering accumulated from the OUTSIDE in, so a nested
 *  row reads "step-2-3" (row 2, sub-row 3) rather than the other way round. */
const expandNode = (node: TemplateElement, row: Row, suffix: string, state: Expansion): ElementInput => {
  const { children, repeat, ...own } = node;
  const filled = fillValue(own, row, state.missing) as Omit<ElementInput, 'children'>;
  const element: ElementInput = { ...filled, ref: `${filled.ref}${suffix}` };

  if (repeat) {
    const rows = listOf(row, repeat.items);
    if (!rows) {
      state.notAList.add(repeat.items);

      return element;
    }

    const capped = rows.slice(0, MAX_ITEMS);
    state.rows += capped.length;
    element.children = capped.map((subRow, index) =>
      expandNode(repeat.template, subRow, `${suffix}-${index + 1}`, state)
    );

    return element;
  }

  if (children) {
    element.children = children.map(child => expandNode(child, row, suffix, state));
  }

  return element;
};

const rowError = (index: number, message: string, hint: string): ValidationError => ({
  path: `items[${index}]`,
  message,
  hint
});

const keysOf = (row: Row): string => Object.keys(row).join(', ') || '(nothing)';

/** Expand one repeat into the single upsertElement it stands for: the wrapper, with the template rendered once per
 *  row as its children. Returns the errors instead of throwing, so a bad row reads like every other op error. */
export const expandRepeat = (op: RepeatElement): { element?: ElementInput; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const children: ElementInput[] = [];
  let total = op.items.length;

  for (const [index, row] of op.items.entries()) {
    const state: Expansion = { missing: new Set(), notAList: new Set(), rows: 0 };
    const expanded = expandNode(op.template, row, `-${index + 1}`, state);
    total += state.rows;

    if (state.missing.size > 0) {
      const fields = [...state.missing];
      errors.push(
        rowError(
          index,
          `Row ${index + 1} has no ${fields.map(field => `"${field}"`).join(', ')}`,
          `The template reads it as {{item.${fields[0]}}}. This row carries: ${keysOf(row)}`
        )
      );
      continue;
    }

    if (state.notAList.size > 0) {
      const [spec] = [...state.notAList];
      errors.push(
        rowError(
          index,
          `Row ${index + 1} has no list at ${spec}`,
          `A nested repeat needs an ARRAY in that field. This row carries: ${keysOf(row)}`
        )
      );
      continue;
    }

    children.push(expanded);
  }

  if (errors.length > 0) {
    return { errors };
  }

  if (total > MAX_ROWS) {
    return {
      errors: [
        {
          path: 'items',
          message: `This repeat expands to ${total} rows (max ${MAX_ROWS})`,
          hint: 'Shorten the lists, or split the widget into several repeats.'
        }
      ]
    };
  }

  return {
    element: {
      ref: op.ref,
      type: op.elementType ?? 'container',
      ...(op.label === undefined ? {} : { label: op.label }),
      ...(op.style === undefined ? {} : { style: op.style }),
      children
    },
    errors
  };
};
