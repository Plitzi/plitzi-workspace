import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { loadTypeScript } from '../projectTypeScript';

import type TypeScript from 'typescript';

/**
 * Any export of a `@plitzi` package by its name — its signature and what its doc says first — read from the `.d.ts` the
 * project installed, so it is always the version the project runs: `@plitzi/sdk-authoring` first, then every other one
 * installed (`createServer`, `createJsonAdapters`, `useChannel`), each entry point it publishes types for. What `plitzi
 * explain` answers for a name its catalogues do not hold (`pageFamily`, `styles`, `SpaceSpec`), so an agent never
 * searches the published types — some 180k tokens — for one line, nor the project's own code for one of the SDK's.
 */

export interface ApiExplanation {
  kind: 'api';
  name: string;
  /** Where it is imported from: `@plitzi/sdk-authoring`, `@plitzi/sdk-server/handlers`. */
  from: string;
  /** A member's: the type it is a member of — `FunctionContext` for `ctx.later`. */
  of?: string;
  /** The first paragraph of its doc, or nothing when it has none. */
  summary: string;
  /** Its declaration as published, cut after `WRITTEN_LINES`. */
  written: string;
  /**
   * What a function takes, field by field: each parameter whose type is a named object of the package's — its
   * constraint, for a generic one — with what each field's doc says first. lx-product's dev-1 read the `.d.ts` 25 times
   * for `defineAction`'s `ActionSpec` and `taskAction`'s options, which `explain` gave as a signature alone.
   */
  takes?: { type: string; fields: { name: string; optional: boolean; doc: string }[] }[];
}

const SCOPE = '@plitzi';

/** Asked first: the package a space is written with, whose names an author means most often. */
const FIRST = 'sdk-authoring';

const WRITTEN_LINES = 14;

/** The fields said of each type a function takes, at most. */
const FIELDS_SAID = 16;

/** The first sentence of a symbol's doc: what a field is, in a line. */
const firstLine = (ts: typeof TypeScript, checker: TypeScript.TypeChecker, symbol: TypeScript.Symbol): string =>
  (ts.displayPartsToString(symbol.getDocumentationComment(checker)).split(/\n\s*\n|(?<=\.)\s/)[0] ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** The named object types a function's parameters are — a generic one's constraint — field by field. */
const takesOf = (
  ts: typeof TypeScript,
  checker: TypeScript.TypeChecker,
  declared: TypeScript.Symbol,
  at: TypeScript.Node
): NonNullable<ApiExplanation['takes']> => {
  const signature = checker.getTypeOfSymbolAtLocation(declared, at).getCallSignatures().at(0);
  if (!signature) {
    return [];
  }

  return signature.parameters.flatMap(parameter => {
    const raw = checker.getTypeOfSymbolAtLocation(parameter, at);
    const type = raw.isTypeParameter() ? (checker.getBaseConstraintOfType(raw) ?? raw) : raw;
    const named = type.aliasSymbol ?? type.getSymbol();
    // An object a @plitzi package names (`ActionSpec`, `TaskActionOptions`): never a literal type, a string, a list.
    const ours = named?.declarations?.some(each => each.getSourceFile().fileName.includes(`/${SCOPE}/`)) ?? false;
    if (!named || !ours || named.name.startsWith('__') || !(type.flags & ts.TypeFlags.Object)) {
      return [];
    }

    const fields = checker
      .getPropertiesOfType(type)
      .slice(0, FIELDS_SAID)
      .map(field => ({
        name: field.name,
        optional: (field.flags & ts.SymbolFlags.Optional) !== 0,
        doc: firstLine(ts, checker, field)
      }));

    return fields.length > 0 ? [{ type: named.name, fields }] : [];
  });
};

/** The `node_modules/@plitzi` nearest `root`. */
const scopeDir = (root: string): string | undefined => {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    const scope = path.join(dir, 'node_modules', SCOPE);
    if (existsSync(scope)) {
      return scope;
    }

    if (path.dirname(dir) === dir) {
      return undefined;
    }
  }
};

/** An entry point a package publishes types for: the path it is imported by, and its `.d.ts`. */
type Entry = { from: string; file: string };

/** The `.d.ts` an `exports` condition names: a string is one only when it is a declaration file. */
const typesOf = (target: unknown): string | undefined => {
  if (typeof target === 'string') {
    return target.endsWith('.d.ts') ? target : undefined;
  }

  return isRecord(target) && typeof target.types === 'string' ? target.types : undefined;
};

/** Every entry point of an installed package that publishes types — `exports` when it has them, else `types`. */
const entriesOf = (dir: string, name: string): Entry[] => {
  const manifestPath = path.join(dir, 'package.json');
  if (!existsSync(manifestPath)) {
    return [];
  }

  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  if (!isRecord(manifest)) {
    return [];
  }

  const entries: Entry[] = isRecord(manifest.exports)
    ? Object.entries(manifest.exports).flatMap(([key, target]) => {
        const types = typesOf(target);
        // A pattern (`./skills/*`) is many files of no one name, and `./package.json` declares nothing.
        if (!types || key.includes('*') || key === './package.json') {
          return [];
        }

        return [{ from: key === '.' ? name : `${name}/${key.slice(2)}`, file: path.join(dir, types) }];
      })
    : [
        {
          from: name,
          file: path.join(dir, typeof manifest.types === 'string' ? manifest.types : 'dist/index.d.ts')
        }
      ];

  return entries.filter(entry => existsSync(entry.file));
};

/** The installed packages, each by its entry points, in the order a name is looked for. */
const installedPackages = (root: string): Entry[][] => {
  const scope = scopeDir(root);
  if (!scope) {
    return [];
  }

  const names = readdirSync(scope).sort((a, b) => Number(b === FIRST) - Number(a === FIRST) || a.localeCompare(b));

  return names.map(name => entriesOf(path.join(scope, name), `${SCOPE}/${name}`)).filter(entries => entries.length > 0);
};

/**
 * Whether a package may export the name, before anything is parsed: a declaration file beside its entry points spells
 * it where an export would — declared (`declare const host`, `interface Host`), or in an export list (`host,`, `as
 * host`). A name that is nothing is answered without building a program for every package installed: a word as common
 * as `host`, spelled anywhere at all, built a program for each package that spelled it: 2.4 s to say it is nothing
 * (lx-controls).
 */
const spells = (entries: readonly Entry[], name: string): boolean => {
  const escaped = name.replace(/\$/g, '\\$');
  // Declared where a statement starts, or named in an export list — never a word of a comment or a parameter.
  const word = new RegExp(
    `(?:^\\s*(?:export\\s+)?(?:declare\\s+)?(?:default\\s+)?(?:abstract\\s+)?(?:const|let|var|function|class|type|interface|enum|namespace)\\s+${escaped}(?![\\w$]))|(?:export\\s*(?:type\\s*)?\\{[^}]*(?<![\\w$])${escaped}(?![\\w$])[^}]*\\})`,
    'm'
  );
  const dirs = new Set(entries.map(entry => path.dirname(entry.file)));
  const files = new Set(
    [...dirs].flatMap(dir =>
      readdirSync(dir, { recursive: true, encoding: 'utf-8' })
        .filter(file => file.endsWith('.d.ts'))
        .map(file => path.join(dir, file))
    )
  );

  return [...files].some(file => word.test(readFileSync(file, 'utf-8')));
};

/** The first paragraph of the doc comment a statement starts with. */
const summaryOf = (sourceFile: TypeScript.SourceFile, statement: TypeScript.Statement): string => {
  const leading = sourceFile.text.slice(statement.getFullStart(), statement.getStart(sourceFile));
  const doc = /\/\*\*([\s\S]*?)\*\//.exec(leading)?.[1] ?? '';
  const text = doc
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim();

  return (text.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
};

/** The declarations as published — under the name it is imported by, when the bundle declared it under another. */
const writtenOf = (
  sourceFile: TypeScript.SourceFile,
  statements: readonly TypeScript.Statement[],
  local: string,
  name: string
): string => {
  const lines = statements
    .map(statement => sourceFile.text.slice(statement.getStart(sourceFile), statement.getEnd()))
    .join('\n')
    .replace(/^(?:export )?declare /gm, '')
    .replace(new RegExp(`\\b${local}\\b`, 'g'), name)
    .split('\n');

  return lines.length > WRITTEN_LINES ? [...lines.slice(0, WRITTEN_LINES), '    …'].join('\n') : lines.join('\n');
};

/** The statement a declaration is part of, at the top of its file — what is printed of it. */
const statementOf = (node: TypeScript.Node): TypeScript.Statement | undefined =>
  node.getSourceFile().statements.find(statement => statement.pos <= node.pos && node.end <= statement.end);

/** The name as one entry exports it, followed through every re-export to where it is declared. */
const lookUp = (
  ts: typeof TypeScript,
  checker: TypeScript.TypeChecker,
  source: TypeScript.SourceFile | undefined,
  name: string
):
  | { declared: TypeScript.Symbol; sourceFile: TypeScript.SourceFile; statements: TypeScript.Statement[] }
  | undefined => {
  const module = source ? checker.getSymbolAtLocation(source) : undefined;
  const exported = module ? checker.getExportsOfModule(module).find(symbol => symbol.name === name) : undefined;
  if (!exported) {
    return undefined;
  }

  const declared = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  const first = declared.declarations?.[0];
  if (!first) {
    return undefined;
  }

  const sourceFile = first.getSourceFile();
  const statements = [
    ...new Set(
      (declared.declarations ?? [])
        .filter(declaration => declaration.getSourceFile() === sourceFile)
        .flatMap(declaration => statementOf(declaration) ?? [])
    )
  ];
  if (statements.length === 0) {
    return undefined;
  }

  return { declared, sourceFile, statements };
};

/**
 * Every installed `@plitzi` package's export of the name — `createServer` is `@plitzi/sdk-server`'s and
 * `@plitzi/sdk-mcp`'s, and an answer naming one would send a reader to the wrong server. One per package: the first of
 * its entry points that exports it.
 */
export const apiDeclarations = (root: string, name: string): ApiExplanation[] => {
  const ts = loadTypeScript(root);
  if (!ts || !/^[\w$]+$/.test(name)) {
    return [];
  }

  return installedPackages(root).flatMap(entries => {
    if (!spells(entries, name)) {
      return [];
    }

    const program = ts.createProgram(
      entries.map(entry => entry.file),
      {
        noEmit: true,
        skipLibCheck: true,
        types: [],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler
      }
    );
    const checker = program.getTypeChecker();
    for (const entry of entries) {
      const found = lookUp(ts, checker, program.getSourceFile(entry.file), name);
      if (found) {
        const { declared, sourceFile, statements } = found;
        const takes = takesOf(ts, checker, declared, statements[0]);

        return [
          {
            kind: 'api' as const,
            name,
            from: entry.from,
            summary: summaryOf(sourceFile, statements[0]),
            written: writtenOf(sourceFile, statements, declared.name, name),
            ...(takes.length > 0 ? { takes } : {})
          }
        ];
      }
    }

    return [];
  });
};

export const apiText = (explanation: ApiExplanation): string =>
  [
    `${explanation.name} — ${explanation.of === undefined ? 'export' : `${explanation.of}'s member`} of ${explanation.from}${explanation.summary ? `: ${explanation.summary}` : ''}`,
    explanation.written,
    ...(explanation.takes ?? []).flatMap(taken => [
      `Takes ${taken.type}:`,
      ...taken.fields.map(field => `  ${field.name}${field.optional ? '?' : ''}${field.doc ? ` — ${field.doc}` : ''}`)
    ])
  ].join('\n');

/** What the code of a space calls the objects it is handed — `ctx.later` is `FunctionContext`'s `later`. */
const RECEIVERS: ReadonlyMap<string, string> = new Map([
  ['ctx', 'FunctionContext'],
  ['job', 'FunctionJobHandle']
]);

/**
 * A member of a type a `@plitzi` package exports — `ctx.later`, `job.save`, `FunctionContext.cancelLater`, or a bare
 * `later` when no export has the name: the method's whole doc and its signature, from the `.d.ts` installed. Encore's
 * lead asked `explain later` and was told it was nothing, while `ctx.later` is what its shows start by.
 */
export const memberDeclarations = (root: string, name: string): ApiExplanation[] => {
  const ts = loadTypeScript(root);
  if (!ts || !/^(?:[\w$]+\.)?[\w$]+$/.test(name)) {
    return [];
  }

  const parts = name.split('.');
  const member = parts[parts.length - 1];
  // `ctx.later` names its owner; a bare `later` is looked for in every object the code is handed.
  const owners = parts.length === 2 ? [[parts[0], RECEIVERS.get(parts[0]) ?? parts[0]] as const] : [...RECEIVERS];

  return installedPackages(root).flatMap(entries =>
    owners.flatMap(([said, owner]) => {
      if (!spells(entries, owner)) {
        return [];
      }

      const program = ts.createProgram(
        entries.map(entry => entry.file),
        {
          noEmit: true,
          skipLibCheck: true,
          types: [],
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler
        }
      );
      const checker = program.getTypeChecker();
      for (const entry of entries) {
        const found = lookUp(ts, checker, program.getSourceFile(entry.file), owner);
        const property = found && checker.getPropertyOfType(checker.getDeclaredTypeOfSymbol(found.declared), member);
        const declaration = property?.declarations?.[0];
        if (property && declaration) {
          const written = declaration.getSourceFile().text.slice(declaration.getStart(), declaration.getEnd());
          const doc = ts.displayPartsToString(property.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();

          return [
            {
              kind: 'api' as const,
              name: `${said}.${member}`,
              from: entry.from,
              of: owner,
              summary: doc,
              written: written.split('\n').slice(0, WRITTEN_LINES).join('\n')
            }
          ];
        }
      }

      return [];
    })
  );
};
