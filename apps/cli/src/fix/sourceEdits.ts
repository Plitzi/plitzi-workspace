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

const literalText = (value: string | number | boolean): string =>
  typeof value === 'string' ? quoted(value) : String(value);

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

/**
 * Where an element's attributes are written besides its props themselves: `attributes: { … }`, and — for a component's
 * instance, whose attributes are the props it hands the component — `props: { … }`.
 */
const ATTRIBUTE_HOLDERS: readonly string[] = ['attributes', 'props'];

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

/** What wrote an element: a factory's call, or — a page, a layout — the object it is declared as. */
type Written = TypeScript.CallExpression | ObjectLiteral;

/** The object literal that starts at a line and column, from 1: how a page or a layout is declared. */
const literalAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  line: number,
  column: number
): ObjectLiteral | undefined => {
  let found: ObjectLiteral | undefined;
  const visit = (node: Node): void => {
    if (found) {
      return;
    }

    if (ts.isObjectLiteralExpression(node)) {
      const at = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
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

/** What is written at a position: the call a factory's name starts there, else the object literal that does. */
const writtenNodeAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): Written | undefined =>
  callAt(ts, sourceFile, position.line, position.column) ?? literalAt(ts, sourceFile, position.line, position.column);

/** The props a factory call was handed: its last object literal — `text('Hi', { … })`, `container({ … })`. */
const propsOf = (ts: Ts, call: TypeScript.CallExpression): ObjectLiteral | undefined =>
  call.arguments.filter(ts.isObjectLiteralExpression).at(-1);

/** The props of what is written: a call's, or the declared object itself. */
const propsOfWritten = (ts: Ts, written: Written): ObjectLiteral | undefined =>
  ts.isCallExpression(written) ? propsOf(ts, written) : written;

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
  nested: readonly string[],
  edit: SpecEdit
): EditOutcome => {
  const inners = nested.map(key => objectAt(ts, object, key)).filter(inner => inner !== undefined);
  const inner = inners.at(0);
  const holder = [object, ...inners].find(candidate => findProperty(ts, candidate, edit.key));
  const property = holder ? findProperty(ts, holder, edit.key) : undefined;

  if (edit.op === 'set') {
    if (edit.value === undefined) {
      return { unplaced: 'there is no value to write' };
    }

    if (!holder || !property) {
      return one(insertInto(sourceFile, inner ?? object, edit.key, literalText(edit.value)));
    }

    if (!ts.isPropertyAssignment(property) || !isLiteral(ts, property.initializer)) {
      return {
        unplaced: `\`${edit.key}\` is written as \`${property.getText(sourceFile)}\` there: change it where that is given`
      };
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
  const written = writtenNodeAt(ts, sourceFile, position);
  if (!written) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  const props = propsOfWritten(ts, written);
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

    return step
      ? editKey(ts, sourceFile, step, ['params'], edit)
      : { unplaced: 'the step is not written in that call' };
  }

  return editKey(ts, sourceFile, props, edit.on === 'attribute' ? ATTRIBUTE_HOLDERS : [], edit);
};

/** The call written at that position, as it is written: what `plitzi element where` shows of an element. */
export const callTextAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): string | undefined => writtenNodeAt(ts, sourceFile, position)?.getText(sourceFile);

/**
 * Words handed first, before the props, are the content (`heading(title, { … })`): a `content` added to the props
 * would win over them and leave them written for nothing, so they are what an edit of the content changes.
 */
const wordsOf = (ts: Ts, call: TypeScript.CallExpression): TypeScript.Expression | undefined => {
  const first = call.arguments.at(0);
  const second = call.arguments.at(1);
  if (!first || ts.isObjectLiteralExpression(first) || ts.isArrayLiteralExpression(first)) {
    return undefined;
  }

  return ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first) || second ? first : undefined;
};

/**
 * An attribute set — or removed, with no value — where the element was written: `plitzi element edit`. `content` written as the
 * factory's first argument (`text('Hi', { … })`) is replaced there; anything else is a key of its props, edited as a
 * fix edits it.
 */
export const attributeEdit = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  key: string,
  value: string | number | boolean | undefined
): EditOutcome => {
  const written = writtenNodeAt(ts, sourceFile, position);
  if (!written) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  const words = key === 'content' && ts.isCallExpression(written) ? wordsOf(ts, written) : undefined;
  if (words) {
    if (!ts.isStringLiteral(words) && !ts.isNoSubstitutionTemplateLiteral(words)) {
      return {
        unplaced: `\`content\` is written as \`${words.getText(sourceFile)}\` there: change it where that is given`
      };
    }

    if (value === undefined) {
      return { unplaced: '`content` is the call’s first argument there: remove it from the call by hand' };
    }

    return one({ start: words.getStart(sourceFile), end: words.getEnd(), text: literalText(value) });
  }

  return sourceEdit(
    ts,
    sourceFile,
    position,
    value === undefined ? { on: 'attribute', op: 'remove', key } : { on: 'attribute', op: 'set', key, value }
  );
};

/** A value handed to a helper: by its place among the arguments, and by its key when they are one object of props. */
export interface ArgumentSlot {
  helper: string;
  argument: number;
  key?: string;
}

/** Where a value is written in a call: an attribute of the element a factory writes, or an argument of a helper. */
export type ValueSlot = { attribute: string } | ArgumentSlot;

/** A value written as a parameter of the helper the call is in, and where the helper's caller hands it. */
export interface ParameterGiven {
  name: string;
  slot: ArgumentSlot;
  /** How many times the helper reads it: more than once, what is handed there is more than this one value. */
  uses: number;
}

const calleeName = (ts: Ts, call: TypeScript.CallExpression): string | undefined => {
  const callee = ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression;

  return ts.isIdentifier(callee) ? callee.text : undefined;
};

/** What a property holds as written: its value, or the name a shorthand reads. */
const propertyValue = (ts: Ts, property: Property | undefined): TypeScript.Expression | undefined => {
  if (property && ts.isPropertyAssignment(property)) {
    return property.initializer;
  }

  return property && ts.isShorthandPropertyAssignment(property) ? property.name : undefined;
};

/** The expression a slot is written as in a call: nothing when the call does not write it. */
const slotExpression = (ts: Ts, written: Written, slot: ValueSlot): TypeScript.Expression | undefined => {
  if ('attribute' in slot) {
    const words = slot.attribute === 'content' && ts.isCallExpression(written) ? wordsOf(ts, written) : undefined;
    const props = propsOfWritten(ts, written);
    const holders = props
      ? [props, ...ATTRIBUTE_HOLDERS.map(key => objectAt(ts, props, key)).filter(inner => inner !== undefined)]
      : [];

    return (
      words ??
      propertyValue(
        ts,
        holders.map(holder => findProperty(ts, holder, slot.attribute)).find(property => property !== undefined)
      )
    );
  }

  const argument =
    ts.isCallExpression(written) && calleeName(ts, written) === slot.helper
      ? written.arguments.at(slot.argument)
      : undefined;
  if (!argument || slot.key === undefined) {
    return argument;
  }

  return ts.isObjectLiteralExpression(argument) ? propertyValue(ts, findProperty(ts, argument, slot.key)) : undefined;
};

type FunctionLike = TypeScript.ArrowFunction | TypeScript.FunctionExpression | TypeScript.FunctionDeclaration;

/** The function a call is written in, and the name it is called by — a declaration's, or the variable's it is held in. */
const enclosingFunction = (ts: Ts, node: Node): { fn: FunctionLike; name: string } | undefined => {
  const at = ts.findAncestor(
    node.parent,
    (ancestor): ancestor is FunctionLike =>
      ts.isArrowFunction(ancestor) || ts.isFunctionExpression(ancestor) || ts.isFunctionDeclaration(ancestor)
  );
  if (!at) {
    return undefined;
  }

  const holder = at.parent;
  const name = ts.isFunctionDeclaration(at)
    ? at.name?.text
    : ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)
      ? holder.name.text
      : undefined;

  return name === undefined ? undefined : { fn: at, name };
};

/** Every place the function reads a name: never a key written beside a value, nor a property of something else. */
const readsOf = (ts: Ts, fn: FunctionLike, name: string): number => {
  let reads = 0;
  const visit = (node: Node): void => {
    const parent = node.parent;
    const isKey =
      (ts.isPropertyAssignment(parent) && parent.name === node) ||
      (ts.isPropertyAccessExpression(parent) && parent.name === node);
    if (ts.isIdentifier(node) && node.text === name && !isKey) {
      reads += 1;
    }

    ts.forEachChild(node, visit);
  };
  if (fn.body) {
    visit(fn.body);
  }

  return reads;
};

/**
 * The parameter of the helper a call is in that a slot is written as — `heading(title, { … })` inside
 * `pageHead(id, kicker, title, line)` — and where its caller hands it: the value the visitor reads is decided there.
 */
export const parameterBehind = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot
): ParameterGiven | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const expression = written && slotExpression(ts, written, slot);
  const helper = written && expression && ts.isIdentifier(expression) ? enclosingFunction(ts, written) : undefined;
  if (!helper || !expression || !ts.isIdentifier(expression)) {
    return undefined;
  }

  const name = expression.text;
  for (const [argument, parameter] of helper.fn.parameters.entries()) {
    if (ts.isIdentifier(parameter.name) && parameter.name.text === name) {
      return { name, slot: { helper: helper.name, argument }, uses: readsOf(ts, helper.fn, name) };
    }

    const element = ts.isObjectBindingPattern(parameter.name)
      ? parameter.name.elements.find(
          binding => !binding.dotDotDotToken && ts.isIdentifier(binding.name) && binding.name.text === name
        )
      : undefined;
    if (element) {
      const key = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : name;

      return { name, slot: { helper: helper.name, argument, key }, uses: readsOf(ts, helper.fn, name) };
    }
  }

  return undefined;
};

/** A value set — or removed — where a slot is written: an element's attribute, or what a helper's caller hands it. */
export const slotEdit = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot,
  value: string | number | boolean | undefined
): EditOutcome => {
  if ('attribute' in slot) {
    return attributeEdit(ts, sourceFile, position, slot.attribute, value);
  }

  const call = callAt(ts, sourceFile, position.line, position.column);
  if (!call || calleeName(ts, call) !== slot.helper) {
    return { unplaced: `\`${slot.helper}(…)\` is not called where it was` };
  }

  if (value === undefined) {
    return { unplaced: `it is handed to \`${slot.helper}\` there: take it out of the call by hand` };
  }

  const argument = call.arguments.at(slot.argument);
  if (!argument) {
    return { unplaced: `\`${slot.helper}\` is not handed it there` };
  }

  if (slot.key !== undefined) {
    return ts.isObjectLiteralExpression(argument)
      ? editKey(ts, sourceFile, argument, [], { on: 'field', op: 'set', key: slot.key, value })
      : {
          unplaced: `\`${slot.helper}\` is handed \`${argument.getText(sourceFile)}\` there: change it where that is given`
        };
  }

  return isLiteral(ts, argument)
    ? one({ start: argument.getStart(sourceFile), end: argument.getEnd(), text: literalText(value) })
    : {
        unplaced: `\`${slot.helper}\` is handed \`${argument.getText(sourceFile)}\` there: change it where that is given`
      };
};

/** How a slot is written in a call, and whether that is a value an edit can write over. */
export const slotText = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot
): { text: string; literal: boolean } | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const expression = written && slotExpression(ts, written, slot);

  return expression ? { text: expression.getText(sourceFile), literal: isLiteral(ts, expression) } : undefined;
};

/** An entry of a list a call is repeated for — `item.question` in `QUESTIONS.flatMap(item => …)` — and where it is. */
export interface ListEntryGiven {
  /** The list, by the name it is declared under. */
  list: string;
  /** The key of each entry the slot reads. */
  key: string;
  /** The module the file imports the list from, as written; absent when it is declared in the same file. */
  from?: string;
}

const LIST_METHODS = new Set(['map', 'flatMap', 'forEach']);

/** The module a file imports a name from, and the name it is exported under there. */
const importOf = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  name: string
): { from: string; exported: string } | undefined => {
  for (const statement of sourceFile.statements) {
    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
    if (
      !bindings ||
      !ts.isNamedImports(bindings) ||
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }

    const element = bindings.elements.find(binding => binding.name.text === name);
    if (element) {
      return { from: statement.moduleSpecifier.text, exported: element.propertyName?.text ?? name };
    }
  }

  return undefined;
};

/** The list a call is repeated for — `LIST.map(item => …)` around it — with the name each entry is read by. */
export interface LoopAround {
  /** The list, by the name it is declared under. */
  list: string;
  /** The parameter each entry is read by inside. */
  item: string;
  /** The module the file imports the list from, as written; absent when it is declared in the same file. */
  from?: string;
}

const loopOf = (ts: Ts, sourceFile: TypeScript.SourceFile, from: Node, item?: string): LoopAround | undefined => {
  const fn = ts.findAncestor(
    from.parent,
    (ancestor): ancestor is TypeScript.ArrowFunction | TypeScript.FunctionExpression => {
      if (!ts.isArrowFunction(ancestor) && !ts.isFunctionExpression(ancestor)) {
        return false;
      }

      const first = ancestor.parameters.at(0);
      const looped = ancestor.parent;

      return (
        !!first &&
        ts.isIdentifier(first.name) &&
        (item === undefined || first.name.text === item) &&
        ts.isCallExpression(looped) &&
        ts.isPropertyAccessExpression(looped.expression) &&
        LIST_METHODS.has(looped.expression.name.text) &&
        ts.isIdentifier(looped.expression.expression)
      );
    }
  );
  const first = fn?.parameters.at(0);
  const looped = fn?.parent;
  if (
    !first ||
    !ts.isIdentifier(first.name) ||
    !looped ||
    !ts.isCallExpression(looped) ||
    !ts.isPropertyAccessExpression(looped.expression) ||
    !ts.isIdentifier(looped.expression.expression)
  ) {
    return undefined;
  }

  const name = looped.expression.expression.text;
  const imported = importOf(ts, sourceFile, name);

  return imported
    ? { list: imported.exported, item: first.name.text, from: imported.from }
    : { list: name, item: first.name.text };
};

/**
 * The list a call hands as a list element's rows — `items: PLANS` or `items: [...PLANS]` — with where it is declared:
 * what each row shows is an entry of it.
 */
export const itemsSource = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): { list: string; from?: string } | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const props = written ? propsOfWritten(ts, written) : undefined;
  const value = props ? propertyValue(ts, findProperty(ts, props, 'items')) : undefined;
  const spread =
    value && ts.isArrayLiteralExpression(value) && value.elements.length === 1 ? value.elements[0] : undefined;
  const named =
    value && ts.isIdentifier(value)
      ? value
      : spread && ts.isSpreadElement(spread) && ts.isIdentifier(spread.expression)
        ? spread.expression
        : undefined;
  if (!named) {
    return undefined;
  }

  const imported = importOf(ts, sourceFile, named.text);

  return imported ? { list: imported.exported, from: imported.from } : { list: named.text };
};

/** The list the call at a position is repeated for, if it is written inside one's `map`. */
export const loopAround = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): LoopAround | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);

  return written ? loopOf(ts, sourceFile, written) : undefined;
};

/**
 * The list a slot reads an entry of: the call is written once inside `LIST.map(item => …)` and the value is
 * `item.key`, so what each element shows is written in the list, one entry per element.
 */
export const listEntryBehind = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  slot: ValueSlot
): ListEntryGiven | undefined => {
  const written = writtenNodeAt(ts, sourceFile, position);
  const expression = written && slotExpression(ts, written, slot);
  if (
    !written ||
    !expression ||
    !ts.isPropertyAccessExpression(expression) ||
    !ts.isIdentifier(expression.expression)
  ) {
    return undefined;
  }

  const loop = loopOf(ts, sourceFile, written, expression.expression.text);

  return loop
    ? { list: loop.list, key: expression.name.text, ...(loop.from === undefined ? {} : { from: loop.from }) }
    : undefined;
};

/** A literal's value as the space reads it; nothing for anything that is not one. */
const literalValue = (ts: Ts, node: Node): string | number | boolean | undefined => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return node.kind === ts.SyntaxKind.TrueKeyword;
  }

  return undefined;
};

/** What a declaration holds under the `as const` and `satisfies` written around it. */
const unwrapped = (ts: Ts, expression: TypeScript.Expression): TypeScript.Expression =>
  ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)
    ? unwrapped(ts, expression.expression)
    : expression;

/**
 * The one entry of a list whose `key` reads `current`, written over with `value`. Found by what it says now, the one
 * thing the element and its entry share: none, or more than one, is said and left to the author.
 */
export const listEntryEdit = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  entry: Pick<ListEntryGiven, 'list' | 'key'>,
  current: unknown,
  value: string | number | boolean | undefined
): EditOutcome => {
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(candidate => ts.isIdentifier(candidate.name) && candidate.name.text === entry.list);
  const list = declaration?.initializer ? unwrapped(ts, declaration.initializer) : undefined;
  if (!list || !ts.isArrayLiteralExpression(list)) {
    return { unplaced: `\`${entry.list}\` is not written as a list there` };
  }

  if (value === undefined) {
    return { unplaced: `it is \`${entry.key}\` of an entry of \`${entry.list}\`: take it out of the entry by hand` };
  }

  const matching = list.elements
    .filter(ts.isObjectLiteralExpression)
    .map(object => findProperty(ts, object, entry.key))
    .filter(
      (property): property is TypeScript.PropertyAssignment =>
        !!property && ts.isPropertyAssignment(property) && literalValue(ts, property.initializer) === current
    );
  if (matching.length !== 1) {
    return {
      unplaced:
        matching.length === 0
          ? `no entry of \`${entry.list}\` writes \`${entry.key}\` as ${JSON.stringify(current)}`
          : `${String(matching.length)} entries of \`${entry.list}\` write \`${entry.key}\` as ${JSON.stringify(current)}: change the one meant by hand`
    };
  }

  const { initializer } = matching[0];

  return one({ start: initializer.getStart(sourceFile), end: initializer.getEnd(), text: literalText(value) });
};

/**
 * The pages and layouts a file declares — an object with an `id` written as words and a `body` — each where its `{`
 * is: the place a page's attributes are edited at, since no factory call writes one.
 */
export const declaredRoots = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile
): { id: string; line: number; column: number }[] => {
  const found: { id: string; line: number; column: number }[] = [];
  const visit = (node: Node): void => {
    if (ts.isObjectLiteralExpression(node) && findProperty(ts, node, 'body')) {
      const id = findProperty(ts, node, 'id');
      if (
        id &&
        ts.isPropertyAssignment(id) &&
        (ts.isStringLiteral(id.initializer) || ts.isNoSubstitutionTemplateLiteral(id.initializer))
      ) {
        const at = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        found.push({ id: id.initializer.text, line: at.line + 1, column: at.character + 1 });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
};

/** Where a call sits among its siblings: the list of children it is an item of, and its place there. */
const placeInList = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): { list: TypeScript.ArrayLiteralExpression; call: TypeScript.CallExpression } | { unplaced: string } => {
  const call = callAt(ts, sourceFile, position.line, position.column);
  if (!call) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  return ts.isArrayLiteralExpression(call.parent)
    ? { list: call.parent, call }
    : { unplaced: 'it is not written as an item of a list of children — it is held or handed on — so by hand' };
};

/**
 * Where an element is an item of a list of children: its own call, or — a section a helper builds and returns,
 * `body: [enterpriseFaq()]` — the call of the helper, named so the caller can follow it there.
 */
export const listItemAt = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): 'item' | { returnedBy: string } | { unplaced: string } => {
  const call = callAt(ts, sourceFile, position.line, position.column);
  if (!call) {
    return { unplaced: 'the call that wrote it is not where it was' };
  }

  if (ts.isArrayLiteralExpression(call.parent)) {
    return 'item';
  }

  const returned = (ts.isArrowFunction(call.parent) && call.parent.body === call) || ts.isReturnStatement(call.parent);
  const helper = returned ? enclosingFunction(ts, call) : undefined;

  return helper
    ? { returnedBy: helper.name }
    : { unplaced: 'it is not written as an item of a list of children — it is held or handed on — so by hand' };
};

/** Whether the call at a position is a call of the named function: the helper an element's own call is returned by. */
export const callsNamed = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  name: string
): boolean => {
  const call = callAt(ts, sourceFile, position.line, position.column);

  return !!call && calleeName(ts, call) === name;
};

/** The element's call taken out of the list it is an item of, with the comma that went with it. */
export const removeItem = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>
): EditOutcome & { removed?: string } => {
  const placed = placeInList(ts, sourceFile, position);
  if ('unplaced' in placed) {
    return placed;
  }

  const index = placed.list.elements.indexOf(placed.call);

  return { ...one(removeFromList(sourceFile, placed.list.elements, index)), removed: placed.call.getText(sourceFile) };
};

/**
 * The element's call moved before or after a sibling in the same list, each item carried with the comments written
 * above it. Two lists are two places in the code: a move between them is the author's.
 */
export const moveItem = (
  ts: Ts,
  sourceFile: TypeScript.SourceFile,
  position: Pick<WrittenPosition, 'line' | 'column'>,
  sibling: Pick<WrittenPosition, 'line' | 'column'>,
  side: 'before' | 'after'
): EditOutcome => {
  const moving = placeInList(ts, sourceFile, position);
  const target = placeInList(ts, sourceFile, sibling);
  if ('unplaced' in moving) {
    return moving;
  }

  if ('unplaced' in target) {
    return { unplaced: `the element to move it ${side}: ${target.unplaced}` };
  }

  if (moving.list !== target.list) {
    return { unplaced: 'the two are not items of the same list of children: moving between them is by hand' };
  }

  const items = [...moving.list.elements].filter(item => item !== moving.call);
  const at = items.indexOf(target.call) + (side === 'after' ? 1 : 0);
  const ordered = [...items.slice(0, at), moving.call, ...items.slice(at)];
  const first = moving.list.elements[0];
  const last = moving.list.elements[moving.list.elements.length - 1];

  return one({
    start: first.getFullStart(),
    end: last.getEnd(),
    text: ordered.map(item => item.getFullText(sourceFile)).join(',')
  });
};

/**
 * What a removal left behind in the file: each top-level, unexported `const x = styles(…)` among `names` that nothing
 * reads any longer — taken out, and named, so nothing goes unsaid. Anything else unread is the linter's to say.
 */
export const pruneDeclarations = (
  ts: Ts,
  fileName: string,
  text: string,
  names: readonly string[]
): { text: string; pruned: string[] } => {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const reads = new Map<string, number>();
  const visit = (node: Node): void => {
    if (ts.isIdentifier(node) && !(ts.isVariableDeclaration(node.parent) && node.parent.name === node)) {
      reads.set(node.text, (reads.get(node.text) ?? 0) + 1);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const pruned: string[] = [];
  const changes: TextChange[] = [];
  for (const statement of sourceFile.statements) {
    const exported = ts.isVariableStatement(statement)
      ? statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
      : true;
    const declarations = ts.isVariableStatement(statement) ? statement.declarationList.declarations : undefined;
    const declaration = declarations?.length === 1 ? declarations[0] : undefined;
    const name = declaration && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
    const initializer = declaration?.initializer;
    const isStyles =
      !!initializer &&
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) &&
      initializer.expression.text === 'styles';
    if (!exported && name && names.includes(name) && isStyles && !reads.get(name)) {
      // With its comments above it; the first of a file takes its line break too, so the file does not open blank.
      const start = statement.getFullStart();
      const end = statement.getEnd() + (start === 0 && text[statement.getEnd()] === '\n' ? 1 : 0);
      changes.push({ start, end, text: '' });
      pruned.push(name);
    }
  }

  return { text: applyChanges(text, changes) ?? text, pruned };
};

/** Every name a piece of code reads: what a removal may have left unread elsewhere in its file. */
export const namesIn = (ts: Ts, code: string): string[] => {
  const sourceFile = ts.createSourceFile('removed.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (ts.isIdentifier(node)) {
      names.add(node.text);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...names];
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
