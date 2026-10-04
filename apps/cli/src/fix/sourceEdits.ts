import type { SpecEdit, WrittenPosition } from '@plitzi/sdk-authoring';
import type TypeScript from 'typescript';

/** A span of the file's text, replaced. */
export interface TextChange {
  start: number;
  end: number;
  text: string;
}

/**
 * The changes an edit makes to the source — one span, or a few where it moves something (children that become an
 * attribute) — or why it makes none, and is left to the author, said.
 */
export type EditOutcome = { changes: TextChange[]; orphans?: string[] } | { unplaced: string };

const one = (change: TextChange): EditOutcome => ({ changes: [change] });

type Ts = typeof TypeScript;
type Node = TypeScript.Node;
type ObjectLiteral = TypeScript.ObjectLiteralExpression;
type Property = TypeScript.ObjectLiteralElementLike;

// \x27 is the single quote: spelled so, it needs no quote of the other kind around it.
const SINGLE = '\x27';

const quoted = (text: string): string =>
  `${SINGLE}${text.replace(/\\/g, '\\\\').replaceAll(SINGLE, `\\${SINGLE}`)}${SINGLE}`;

const literalText = (value: string | boolean): string => (typeof value === 'string' ? quoted(value) : String(value));

const keyText = (key: string): string => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : quoted(key));

/** A property's name as written: `mode`, `'aria-label'`. */
const nameOf = (ts: Ts, property: Property): string | undefined => {
  const name = property.name;
  if (!name) {
    return undefined;
  }

  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
};

const findProperty = (ts: Ts, object: ObjectLiteral, key: string): Property | undefined =>
  object.properties.find(property => nameOf(ts, property) === key);

/** The object literal a property holds, when it holds one: `attributes: { … }`, `params: { … }`. */
const objectAt = (ts: Ts, object: ObjectLiteral, key: string): ObjectLiteral | undefined => {
  const property = findProperty(ts, object, key);

  return property && ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)
    ? property.initializer
    : undefined;
};

/** One item of a comma list taken out, with the comma that went with it. */
const removeFromList = (sourceFile: TypeScript.SourceFile, items: readonly Node[], index: number): TextChange => {
  const item = items[index];
  if (index < items.length - 1) {
    return { start: item.getStart(sourceFile), end: items[index + 1].getStart(sourceFile), text: '' };
  }

  if (index > 0) {
    return { start: items[index - 1].getEnd(), end: item.getEnd(), text: '' };
  }

  return { start: item.getStart(sourceFile), end: item.getEnd(), text: '' };
};

/** The call written at the factory's name: `container(` at that line and column, from 1. */
const callAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  line: number,
  column: number
): TypeScript.CallExpression | undefined => {
  let found: TypeScript.CallExpression | undefined;
  const visit = (node: Node): void => {
    if (found) {
      return;
    }

    if (ts.isCallExpression(node)) {
      const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
      const at = sourceFile.getLineAndCharacterOfPosition(callee.getStart(sourceFile));
      if (at.line + 1 === line && at.character + 1 === column) {
        found = node;

        return;
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
};

/** The props a factory call was handed: its last object literal — `text('Hi', { … })`, `container({ … })`. */
const propsOf = (ts: Ts, call: TypeScript.CallExpression): ObjectLiteral | undefined =>
  call.arguments.filter(ts.isObjectLiteralExpression).at(-1);

/**
 * The object a step was written with: itself when it is a literal, a builder's own props (`setState({ … })`), or —
 * through a wrapper (`named('x', …)`, `when(rule, …)`) — the step it wraps, which is its last argument.
 */
const stepObject = (ts: Ts, expression: TypeScript.Expression): ObjectLiteral | undefined => {
  if (ts.isObjectLiteralExpression(expression)) {
    return expression;
  }

  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  const last = expression.arguments.at(-1);
  if (last && ts.isCallExpression(last)) {
    return stepObject(ts, last);
  }

  return expression.arguments.filter(ts.isObjectLiteralExpression).at(-1);
};

const stepIn = (ts: Ts, props: ObjectLiteral, flow: number, index: number): ObjectLiteral | undefined => {
  const flows = findProperty(ts, props, 'flows');
  if (!flows || !ts.isPropertyAssignment(flows) || !ts.isArrayLiteralExpression(flows.initializer)) {
    return undefined;
  }

  const steps = flows.initializer.elements.at(flow);
  const step = steps && ts.isArrayLiteralExpression(steps) ? steps.elements.at(index) : undefined;

  return step ? stepObject(ts, step) : undefined;
};

const isLiteral = (ts: Ts, node: Node): boolean =>
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isNumericLiteral(node) ||
  node.kind === ts.SyntaxKind.TrueKeyword ||
  node.kind === ts.SyntaxKind.FalseKeyword ||
  node.kind === ts.SyntaxKind.NullKeyword;

/** `key: value` added to an object literal, after what it already holds. */
const insertInto = (
  sourceFile: TypeScript.SourceFile,
  object: ObjectLiteral,
  key: string,
  value: string
): TextChange => {
  const last = object.properties.at(-1);
  if (!last) {
    return { start: object.getStart(sourceFile), end: object.getEnd(), text: `{ ${keyText(key)}: ${value} }` };
  }

  return { start: last.getEnd(), end: last.getEnd(), text: `, ${keyText(key)}: ${value}` };
};

/** An edit to one key of `object` — or of what it nests the key in (`attributes`, `params`). */
const editKey = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  object: ObjectLiteral,
  nested: string | undefined,
  edit: SpecEdit
): EditOutcome => {
  const inner = nested === undefined ? undefined : objectAt(ts, object, nested);
  const holder = findProperty(ts, object, edit.key)
    ? object
    : inner && findProperty(ts, inner, edit.key)
      ? inner
      : undefined;
  const property = holder ? findProperty(ts, holder, edit.key) : undefined;

  if (edit.op === 'set') {
    if (edit.value === undefined) {
      return { unplaced: 'there is no value to write' };
    }

    if (!holder || !property) {
      return one(insertInto(sourceFile, inner ?? object, edit.key, literalText(edit.value)));
    }

    if (!ts.isPropertyAssignment(property) || !isLiteral(ts, property.initializer)) {
      return { unplaced: `\`${edit.key}\` is not written as a value there` };
    }

    return one({
      start: property.initializer.getStart(sourceFile),
      end: property.initializer.getEnd(),
      text: literalText(edit.value)
    });
  }

  if (!holder || !property) {
    return { unplaced: `\`${edit.key}\` is not written in that call` };
  }

  if (edit.op === 'remove') {
    return one(removeFromList(sourceFile, holder.properties, holder.properties.indexOf(property)));
  }

  if (edit.op === 'rename' && edit.to !== undefined) {
    if (ts.isShorthandPropertyAssignment(property)) {
      return one({
        start: property.getStart(sourceFile),
        end: property.getEnd(),
        text: `${keyText(edit.to)}: ${property.name.text}`
      });
    }

    if (ts.isPropertyAssignment(property)) {
      return one({ start: property.name.getStart(sourceFile), end: property.name.getEnd(), text: keyText(edit.to) });
    }
  }

  return { unplaced: `\`${edit.key}\` is not a property that edit applies to` };
};

/** A binding by its target: a key of `bind: { … }`, or the entry of `bind: [ … ]` whose `to` it is. */
const editBinding = (ts: Ts, sourceFile: TypeScript.SourceFile, props: ObjectLiteral, edit: SpecEdit): EditOutcome => {
  const bind = findProperty(ts, props, 'bind');
  if (!bind || !ts.isPropertyAssignment(bind)) {
    return { unplaced: 'the binding is not written in that call' };
  }

  const list = bind.initializer;
  if (edit.op === 'replace' && edit.to !== undefined) {
    let found: TypeScript.StringLiteral | undefined;
    const visit = (node: Node): void => {
      if (
        !found &&
        ts.isStringLiteral(node) &&
        node.text === edit.key &&
        ts.isPropertyAssignment(node.parent) &&
        nameOf(ts, node.parent) === 'action'
      ) {
        found = node;
      }

      ts.forEachChild(node, visit);
    };
    visit(list);

    return found
      ? one({ start: found.getStart(sourceFile), end: found.getEnd(), text: quoted(edit.to) })
      : { unplaced: `"${edit.key}" is not written as a transformer there` };
  }

  if (edit.op !== 'remove') {
    return { unplaced: 'that change to a binding has no one way to be written' };
  }

  // The last binding taken out takes `bind` with it: an empty one says nothing.
  const dropBind = (): EditOutcome => one(removeFromList(sourceFile, props.properties, props.properties.indexOf(bind)));

  if (ts.isObjectLiteralExpression(list)) {
    const property = findProperty(ts, list, edit.key);
    if (!property) {
      return { unplaced: `the binding onto "${edit.key}" is not written there` };
    }

    return list.properties.length === 1
      ? dropBind()
      : one(removeFromList(sourceFile, list.properties, list.properties.indexOf(property)));
  }

  if (ts.isArrayLiteralExpression(list)) {
    const index = list.elements.findIndex(entry => {
      if (!ts.isObjectLiteralExpression(entry)) {
        return false;
      }

      const to = findProperty(ts, entry, 'to');

      return (
        to !== undefined &&
        ts.isPropertyAssignment(to) &&
        ts.isStringLiteral(to.initializer) &&
        to.initializer.text === edit.key
      );
    });

    if (index === -1) {
      return { unplaced: `the binding onto "${edit.key}" is not written there` };
    }

    return list.elements.length === 1 ? dropBind() : one(removeFromList(sourceFile, list.elements, index));
  }

  return { unplaced: '`bind` is not written as a literal there' };
};

/** The factories a child of the moved kind is written with: what a move may leave imported and unused. */
const WORD_FACTORIES = ['text', 'fontAwesome'];

/**
 * `children: [text(words), fontAwesome({ icon })]` written as the element's own `content: words, icon` — the words
 * kept as written, a literal or an expression (`entry.label`). Only children written exactly so are moved: a `text`
 * handed options (a class, an id) or an icon with more than its class is something the element's own attributes would
 * not say, and is left for the author.
 */
const moveChildrenToContent = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  props: ObjectLiteral,
  edit: SpecEdit
): EditOutcome => {
  const children = findProperty(ts, props, 'children');
  if (!children || !ts.isPropertyAssignment(children) || !ts.isArrayLiteralExpression(children.initializer)) {
    return { unplaced: '`children` is not written as a list there' };
  }

  let words: TypeScript.Expression | undefined;
  let icon: TypeScript.Expression | undefined;
  for (const child of children.initializer.elements) {
    // A factory handed one argument: a second is options — a class, an id — that would not move with the words.
    const call =
      ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.arguments.length === 1
        ? { factory: child.expression.text, argument: child.arguments[0] }
        : undefined;
    if (call?.factory === 'text' && !words) {
      words = call.argument;
      continue;
    }

    const iconProperty =
      call?.factory === 'fontAwesome' &&
      ts.isObjectLiteralExpression(call.argument) &&
      call.argument.properties.length === 1
        ? findProperty(ts, call.argument, 'icon')
        : undefined;
    if (iconProperty && ts.isPropertyAssignment(iconProperty) && !icon) {
      icon = iconProperty.initializer;
      continue;
    }

    return { unplaced: 'a child carries more than its words or its icon there' };
  }

  if (Boolean(icon) !== (edit.icon !== undefined) || (words === undefined && edit.value !== '')) {
    return { unplaced: 'the children written there are not the ones it holds' };
  }

  if (words && ts.isStringLiteral(words) && words.text !== edit.value) {
    return { unplaced: 'the words written there are not the ones it shows' };
  }

  if (icon && findProperty(ts, props, 'icon')) {
    return { unplaced: 'it is written with an `icon` of its own already' };
  }

  // A `content: ''` written beside the children goes: it said "no words of its own", which is no longer so.
  const content = findProperty(ts, props, 'content');
  if (
    content &&
    words &&
    !(ts.isPropertyAssignment(content) && ts.isStringLiteral(content.initializer) && content.initializer.text === '')
  ) {
    return { unplaced: 'it is written with words of its own beside its children' };
  }

  const written = [
    words && `content: ${words.getText(sourceFile)}`,
    icon && `icon: ${icon.getText(sourceFile)}`,
    edit.iconPlacement && `iconPlacement: ${quoted(edit.iconPlacement)}`
  ].filter((part): part is string => Boolean(part));

  return {
    changes: [
      ...(content && words ? [removeFromList(sourceFile, props.properties, props.properties.indexOf(content))] : []),
      { start: children.getStart(sourceFile), end: children.getEnd(), text: written.join(', ') }
    ],
    orphans: WORD_FACTORIES
  };
};

/**
 * The named imports among `names` that nothing in the file uses any longer — what a move left behind, taken out with
 * the import that held only them.
 */
export const pruneImports = (ts: Ts, fileName: string, text: string, names: readonly string[]): string => {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const used = new Set<string>();
  const visit = (node: Node): void => {
    if (ts.isIdentifier(node) && !ts.isImportSpecifier(node.parent)) {
      used.add(node.text);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const changes: TextChange[] = [];
  for (const statement of sourceFile.statements) {
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
    const bindings = clause?.namedBindings;
    if (!clause || !bindings || !ts.isNamedImports(bindings)) {
      continue;
    }

    const elements = bindings.elements;
    const unused = elements.filter(element => names.includes(element.name.text) && !used.has(element.name.text));
    if (unused.length === 0) {
      continue;
    }

    if (unused.length === elements.length && !clause.name) {
      changes.push({ start: statement.getFullStart(), end: statement.getEnd(), text: '' });
      continue;
    }

    const kept = elements.filter(element => !unused.includes(element));
    changes.push({
      start: bindings.getStart(sourceFile),
      end: bindings.getEnd(),
      text: `{ ${kept.map(element => element.getText(sourceFile)).join(', ')} }`
    });
  }

  return applyChanges(text, changes) ?? text;
};

/**
 * What an edit planned on a spec changes in the source that wrote it: the call at its position, the props it was
 * handed, and in them only what is written as a literal. Anything else — a value computed, props spread from a
 * variable, a flow built elsewhere — is left as it was and said, for the author.
 */
export const sourceEdit = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  edit: SpecEdit
): EditOutcome => {
  const call = callAt(ts, sourceFile, position.line, position.column);
  if (!call) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  const props = propsOf(ts, call);
  if (!props) {
    return { unplaced: 'the call that wrote it was handed no props to edit' };
  }

  if (edit.on === 'binding') {
    return editBinding(ts, sourceFile, props, edit);
  }

  if (edit.on === 'children') {
    return moveChildrenToContent(ts, sourceFile, props, edit);
  }

  if (edit.on === 'step') {
    const step = edit.step ? stepIn(ts, props, edit.step.flow, edit.step.index) : undefined;

    return step ? editKey(ts, sourceFile, step, 'params', edit) : { unplaced: 'the step is not written in that call' };
  }

  return editKey(ts, sourceFile, props, edit.on === 'attribute' ? 'attributes' : undefined, edit);
};

/** The text with every change made — from the end back, so each span is where it was found. Overlaps are refused. */
export const applyChanges = (text: string, changes: readonly TextChange[]): string | undefined => {
  const ordered = [...changes].toSorted((a, b) => b.start - a.start);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].end > ordered[index - 1].start) {
      return undefined;
    }
  }

  return ordered.reduce(
    (result, change) => result.slice(0, change.start) + change.text + result.slice(change.end),
    text
  );
};
