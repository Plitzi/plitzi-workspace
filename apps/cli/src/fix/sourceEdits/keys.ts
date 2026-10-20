import { applyChanges } from './apply';
import {
  ATTRIBUTE_HOLDERS,
  findProperty,
  insertInto,
  isLiteral,
  keyText,
  literalText,
  nameOf,
  objectAt,
  one,
  propsOfWritten,
  quoted,
  removeFromList,
  stepIn,
  writtenNodeAt
} from './ast';

import type { EditOutcome, Node, ObjectLiteral, TextChange, Ts } from './ast';
import type { SpecEdit, WrittenPosition } from '@plitzi/sdk-authoring';
import type TypeScript from 'typescript';

/**
 * An edit of a key where it is written: a field, a binding, children moved to `content` — and the imports it leaves.
 */

/** An edit to one key of `object` — or of what it nests the key in (`attributes`, `params`). */
export const editKey = (
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

  // What the key holds, put in its place one level up — each property as it is written, its value's text kept.
  if (edit.op === 'unwrap') {
    if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
      return { unplaced: `\`${edit.key}\` is not written as an object there: move what it holds up by hand` };
    }

    return one({
      start: property.getStart(sourceFile),
      end: property.getEnd(),
      text: property.initializer.properties.map(inner => inner.getText(sourceFile)).join(', ')
    });
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
