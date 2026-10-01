import ts from 'typescript';

import type { FunctionTaskManifest, FunctionTimeLimits } from '@plitzi/sdk-shared';
import type { VirtualTypeScriptEnvironment } from '@typescript/vfs';

/**
 * The space's functions as their SOURCE declares them, read while they are written — what the panel lists and edits
 * before anything is saved. Static: the object literals `defineFunctions` is handed, followed through the constants and
 * the files they come from; nothing is run. What cannot be read that way (a task built by a function call) is said, not
 * guessed. Saving still asks the platform, which runs the bundle and is the one that decides.
 */

/** Where something is written: the file — as the panel names it, `lib/feed.ts` — and its place in it. */
/** Where something is written: its file, the line it starts on, and the offsets it spans there. */
export type SourcePlace = { file: string; line: number; start: number; end: number };

export type SourceTask = Pick<FunctionTaskManifest, 'namespace' | 'action' | 'title' | 'description' | 'params'> & {
  limits?: FunctionTimeLimits;
  at: SourcePlace;
};

export type SourceRoute = { key: string; at: SourcePlace };

export type SourceFunctions = {
  /** `index.ts` exports `defineFunctions(…)` — without it there is nothing declared to read. */
  defined: boolean;
  tasks: SourceTask[];
  routes: SourceRoute[];
  hosts: string[];
  /** What every task and route asks for, unless one asks for its own. */
  limits?: FunctionTimeLimits;
  /** Entries that are there but cannot be read without running the code: what to look at, and where. */
  unreadable: { what: string; at: SourcePlace }[];
};

/** The root the worker keeps the space's files under — `/functions/lib/feed.ts` is `lib/feed.ts` to the panel. */
export const FUNCTIONS_ROOT = '/functions/';

const ENTRY = `${FUNCTIONS_ROOT}index.ts`;

const panelPath = (fileName: string): string =>
  fileName.startsWith(FUNCTIONS_ROOT) ? fileName.slice(FUNCTIONS_ROOT.length) : fileName;

const placeOf = (node: ts.Node): SourcePlace => {
  const source = node.getSourceFile();
  const start = node.getStart(source);

  return {
    file: panelPath(source.fileName),
    line: source.getLineAndCharacterOfPosition(start).line + 1,
    start,
    end: node.getEnd()
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value as it is written, without what only wraps it: parentheses, `as`, `satisfies`, `!`. */
const unwrapped = (node: ts.Expression): ts.Expression => {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }

  return current;
};

/**
 * What a name stands for: followed to the constant it is — through an import, to the other file — and that constant's
 * value. A name it cannot follow stays the name.
 */
const resolved = (node: ts.Expression, checker: ts.TypeChecker): ts.Expression => {
  const value = unwrapped(node);
  if (!ts.isIdentifier(value)) {
    return value;
  }

  const symbol = checker.getSymbolAtLocation(value);
  const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declaration = target?.valueDeclaration ?? target?.declarations?.[0];
  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
    return resolved(declaration.initializer, checker);
  }

  return value;
};

/** `defineFunctions({ … })` — or the object itself, written without it — as the object. */
const definitionObject = (node: ts.Expression, checker: ts.TypeChecker): ts.ObjectLiteralExpression | undefined => {
  const value = resolved(node, checker);
  if (ts.isObjectLiteralExpression(value)) {
    return value;
  }

  const argument = ts.isCallExpression(value) ? value.arguments.at(0) : undefined;
  if (argument) {
    const object = resolved(argument, checker);

    return ts.isObjectLiteralExpression(object) ? object : undefined;
  }

  return undefined;
};

const propertyName = (property: ts.ObjectLiteralElementLike): string | undefined => {
  const { name } = property;
  if (!name) {
    return undefined;
  }

  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name)) {
    const expression = unwrapped(name.expression);

    return ts.isStringLiteralLike(expression) ? expression.text : undefined;
  }

  return undefined;
};

/** A property's value, by its name — `undefined` when it is not there, or not written as `name: value`. */
const propertyOf = (object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined => {
  const property = object.properties.find(candidate => propertyName(candidate) === name);

  return property && ts.isPropertyAssignment(property) ? property.initializer : undefined;
};

/** A literal as the value it writes: text, a number, a boolean, a list or an object of them — anything else nothing. */
const literalValue = (node: ts.Expression, checker: ts.TypeChecker): unknown => {
  const value = resolved(node, checker);
  if (ts.isStringLiteralLike(value)) {
    return value.text;
  }

  if (ts.isNumericLiteral(value)) {
    return Number(value.text);
  }

  if (
    ts.isPrefixUnaryExpression(value) &&
    value.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(value.operand)
  ) {
    return -Number(value.operand.text);
  }

  if (value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword) {
    return value.kind === ts.SyntaxKind.TrueKeyword;
  }

  if (ts.isArrayLiteralExpression(value)) {
    return value.elements.map(element => literalValue(element, checker));
  }

  if (ts.isObjectLiteralExpression(value)) {
    return Object.fromEntries(
      value.properties.flatMap(property => {
        const name = propertyName(property);

        return name !== undefined && ts.isPropertyAssignment(property)
          ? [[name, literalValue(property.initializer, checker)]]
          : [];
      })
    );
  }

  return undefined;
};

const textOf = (object: ts.ObjectLiteralExpression, name: string, checker: ts.TypeChecker): string | undefined => {
  const value = propertyOf(object, name);
  const read = value ? literalValue(value, checker) : undefined;

  return typeof read === 'string' ? read : undefined;
};

/** What a task or the functions ask for: whole positive milliseconds, as the platform would keep them. */
const limitsOf = (object: ts.ObjectLiteralExpression, checker: ts.TypeChecker): FunctionTimeLimits | undefined => {
  const value = propertyOf(object, 'limits');
  const read = value ? literalValue(value, checker) : undefined;
  if (!isRecord(read)) {
    return undefined;
  }

  const limits: FunctionTimeLimits = {};
  const { cpuMs, wallMs } = read;
  if (typeof cpuMs === 'number') {
    limits.cpuMs = cpuMs;
  }

  if (typeof wallMs === 'number') {
    limits.wallMs = wallMs;
  }

  return Object.keys(limits).length ? limits : undefined;
};

/** The elements of a list as written — a list spread into it read as its own elements. */
const elementsOf = (node: ts.Expression, checker: ts.TypeChecker): ts.Expression[] => {
  const value = resolved(node, checker);
  if (!ts.isArrayLiteralExpression(value)) {
    return [];
  }

  return value.elements.flatMap(element =>
    ts.isSpreadElement(element) ? elementsOf(element.expression, checker) : [element]
  );
};

/** The definition `index.ts` exports by default, when it exports one. */
const exportedDefinition = (program: ts.Program, checker: ts.TypeChecker): ts.ObjectLiteralExpression | undefined => {
  const entry = program.getSourceFile(ENTRY);
  const exported = entry?.statements.find((statement): statement is ts.ExportAssignment =>
    ts.isExportAssignment(statement)
  );

  return exported ? definitionObject(exported.expression, checker) : undefined;
};

const programOf = (env: VirtualTypeScriptEnvironment): { program: ts.Program; checker: ts.TypeChecker } | undefined => {
  const program = env.languageService.getProgram();

  return program ? { program, checker: program.getTypeChecker() } : undefined;
};

const NONE: SourceFunctions = { defined: false, tasks: [], routes: [], hosts: [], unreadable: [] };

export const describeSource = (env: VirtualTypeScriptEnvironment): SourceFunctions => {
  const found = programOf(env);
  const definition = found ? exportedDefinition(found.program, found.checker) : undefined;
  if (!found || !definition) {
    return NONE;
  }

  const { checker } = found;
  const unreadable: SourceFunctions['unreadable'] = [];
  const tasks = elementsOf(
    propertyOf(definition, 'tasks') ?? ts.factory.createArrayLiteralExpression(),
    checker
  ).flatMap((element): SourceTask[] => {
    const task = resolved(element, checker);
    if (!ts.isObjectLiteralExpression(task)) {
      unreadable.push({ what: element.getText(), at: placeOf(element) });

      return [];
    }

    const params = literalValue(propertyOf(task, 'params') ?? ts.factory.createObjectLiteralExpression(), checker);
    const description = textOf(task, 'description', checker);
    const limits = limitsOf(task, checker);

    return [
      {
        namespace: textOf(task, 'namespace', checker) ?? '',
        action: textOf(task, 'action', checker) ?? '',
        title: textOf(task, 'title', checker) ?? '',
        ...(description ? { description } : {}),
        // Read off the source as it is written, and shown as such: the platform checks each param's shape when the
        // functions are saved, and refuses what the builder could not draw.
        params: (isRecord(params) ? params : {}) as SourceTask['params'],
        ...(limits ? { limits } : {}),
        at: placeOf(task)
      }
    ];
  });
  const routesObject = resolved(
    propertyOf(definition, 'routes') ?? ts.factory.createObjectLiteralExpression(),
    checker
  );
  const routes = ts.isObjectLiteralExpression(routesObject)
    ? routesObject.properties.flatMap(property => {
        const key = propertyName(property);

        return key === undefined ? [] : [{ key, at: placeOf(property) }];
      })
    : [];
  const allow = propertyOf(definition, 'allow');
  const allowed = allow ? literalValue(allow, checker) : undefined;
  const listed = isRecord(allowed) ? allowed.hosts : undefined;
  const hosts = Array.isArray(listed) ? listed.filter((host): host is string => typeof host === 'string') : [];
  const limits = limitsOf(definition, checker);

  return { defined: true, tasks, routes, hosts, ...(limits ? { limits } : {}), unreadable };
};

/** A file of the space's, written again: what a panel puts back in its files. */
export type SourceEdit = { file: string; code: string };

/** The indentation the line `position` is on. */
const indentAt = (text: string, position: number): string => {
  const lineStart = text.lastIndexOf('\n', position - 1) + 1;

  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
};

const objectAt = (env: VirtualTypeScriptEnvironment, place: SourcePlace): ts.ObjectLiteralExpression | undefined => {
  const source = env.getSourceFile(`${FUNCTIONS_ROOT}${place.file}`);
  let found: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isObjectLiteralExpression(node) && node.getStart(source) === place.start) {
      found = node;

      return;
    }

    ts.forEachChild(node, visit);
  };
  if (source) {
    visit(source);
  }

  return found;
};

const limitsText = ({ cpuMs, wallMs }: FunctionTimeLimits): string =>
  `{ ${[cpuMs === undefined ? '' : `cpuMs: ${String(cpuMs)}`, wallMs === undefined ? '' : `wallMs: ${String(wallMs)}`]
    .filter(Boolean)
    .join(', ')} }`;

/**
 * The task written at `place`, asking for `limits` — written into its own `limits`, or that taken out when it asks for
 * nothing. Its other properties, comments and formatting are left as they are: the edit is the one property.
 */
export const withTaskLimits = (
  env: VirtualTypeScriptEnvironment,
  place: SourcePlace,
  limits: FunctionTimeLimits
): SourceEdit | undefined => {
  const task = objectAt(env, place);
  if (!task) {
    return undefined;
  }

  const source = task.getSourceFile();
  const text = source.getFullText();
  const asksFor = limits.cpuMs !== undefined || limits.wallMs !== undefined;
  const existing = task.properties.find(property => propertyName(property) === 'limits');
  if (existing) {
    if (asksFor && ts.isPropertyAssignment(existing)) {
      const value = existing.initializer;

      return {
        file: place.file,
        code: `${text.slice(0, value.getStart(source))}${limitsText(limits)}${text.slice(value.getEnd())}`
      };
    }

    // Asking for nothing: the property goes, its line and its comma with it.
    const from = text.lastIndexOf('\n', existing.getStart(source) - 1);
    const after = text.slice(existing.getEnd()).match(/^\s*,/)?.[0].length ?? 0;

    return { file: place.file, code: `${text.slice(0, from)}${text.slice(existing.getEnd() + after)}` };
  }

  if (!asksFor) {
    return { file: place.file, code: text };
  }

  // A new property, on a line of its own before `run` — where it reads as a setting of what follows — or after the last.
  const run = task.properties.find(property => propertyName(property) === 'run');
  if (run) {
    const at = run.getStart(source);

    return {
      file: place.file,
      code: `${text.slice(0, at)}limits: ${limitsText(limits)},\n${indentAt(text, at)}${text.slice(at)}`
    };
  }

  const last = task.properties.at(-1);
  if (!last) {
    const at = task.getStart(source) + 1;

    return { file: place.file, code: `${text.slice(0, at)} limits: ${limitsText(limits)} ${text.slice(at)}` };
  }

  const end = last.getEnd();
  const comma = text.slice(end).match(/^\s*,/)?.[0].length ?? 0;

  return {
    file: place.file,
    code: `${text.slice(0, end + comma)}${comma ? '' : ','}\n${indentAt(text, last.getStart(source))}limits: ${limitsText(limits)}${text.slice(end + comma)}`
  };
};

/** A new task, as `New task` writes it: what it is called, and a `run` that answers with something to see. */
export type NewTask = { namespace: string; action: string; title: string };

/** The quote the file writes its strings with — single unless it writes more double ones — so what is added reads alike. */
const quoteOf = (text: string): string =>
  (text.match(/"/g) ?? []).length > (text.match(/'/g) ?? []).length ? '"' : '\u0027';

const stringIn = (value: string, quote: string): string =>
  `${quote}${value.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`;

const taskText = ({ namespace, action, title }: NewTask, indent: string, quote: string): string => {
  const inner = `${indent}  `;

  return [
    '{',
    `${inner}namespace: ${stringIn(namespace, quote)},`,
    `${inner}action: ${stringIn(action, quote)},`,
    `${inner}title: ${stringIn(title, quote)},`,
    `${inner}params: {},`,
    `${inner}run: async (params, ctx) => {`,
    `${inner}  ctx.log(${stringIn(`${namespace}.${action}`, quote)}, params);`,
    '',
    `${inner}  return { ok: true };`,
    `${inner}}`,
    `${indent}}`
  ].join('\n');
};

const lineAt = (source: ts.SourceFile, position: number): number => source.getLineAndCharacterOfPosition(position).line;

/**
 * `index.ts` with a new task at the end of the list `defineFunctions` is handed — a list started for it when there is
 * none. What it adds is answered too, so the panel can open it where it was written.
 */
export const withNewTask = (env: VirtualTypeScriptEnvironment, task: NewTask): SourceEdit | undefined => {
  const found = programOf(env);
  const definition = found ? exportedDefinition(found.program, found.checker) : undefined;
  const source = env.getSourceFile(ENTRY);
  if (!definition || !source || definition.getSourceFile() !== source) {
    return undefined;
  }

  const text = source.getFullText();
  const tasks = propertyOf(definition, 'tasks');
  const list = tasks ? unwrapped(tasks) : undefined;
  const quote = quoteOf(text);
  if (list && ts.isArrayLiteralExpression(list)) {
    const start = list.getStart(source);
    const listIndent = indentAt(text, start);
    const first = list.elements.at(0);
    const last = list.elements.at(-1);
    // Empty, or written on the line it opens — `[feedTask, detailTask]` — the list is written again one task a line.
    if (!first || !last || lineAt(source, first.getStart(source)) === lineAt(source, start)) {
      const itemIndent = `${listIndent}  `;
      const items = [...list.elements.map(element => element.getText(source)), taskText(task, itemIndent, quote)];

      return {
        file: 'index.ts',
        code: `${text.slice(0, start)}[\n${items.map(item => `${itemIndent}${item}`).join(',\n')}\n${listIndent}]${text.slice(list.getEnd())}`
      };
    }

    const itemIndent = indentAt(text, last.getStart(source));
    const end = last.getEnd();

    return {
      file: 'index.ts',
      code: `${text.slice(0, end)},\n${itemIndent}${taskText(task, itemIndent, quote)}${text.slice(end)}`
    };
  }

  // No list yet: one, as the definition's first property.
  const first = definition.properties.at(0);
  const at = first ? first.getStart(source) : definition.getStart(source) + 1;
  const indent = first ? indentAt(text, at) : `${indentAt(text, definition.getStart(source))}  `;

  return {
    file: 'index.ts',
    code: `${text.slice(0, at)}${first ? '' : '\n' + indent}tasks: [\n${indent}  ${taskText(task, `${indent}  `, quote)}\n${indent}]${first ? `,\n${indent}` : '\n'}${text.slice(at)}`
  };
};
