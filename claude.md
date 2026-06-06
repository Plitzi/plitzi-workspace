# plitzi-workspace

Turborepo monorepo that contains all Plitzi frontend apps and shared packages.

Human-readable guides: [docs/en/](./docs/en/README.md) · [docs/es/](./docs/es/README.md). This file is the full contributor convention reference.

## Stack

- **Language**: TypeScript + React 19
- **Build**: Vite (per package/app), Turborepo for orchestration
- **Testing**: Vitest + `@testing-library/react`
- **Styling**: Tailwind CSS v4
- **Package manager**: Yarn 4 (workspaces)
- **Storybook**: for UI component development

## Commands

```bash
# Workspace-level (Turbo)
yarn start                  # start all apps in parallel
yarn build:dev              # dev build
yarn build:prod             # prod build
yarn test                   # run all tests
yarn lint                   # lint all packages
yarn typecheck              # typecheck all packages

# Per-package (cd into app/package first)
yarn start                  # start that app
yarn test                   # vitest run
yarn test:coverage          # vitest + coverage
yarn lint                   # eslint ./src
yarn typecheck              # tsc --noEmit
yarn build:dev / build:prod # vite build
```

## Project Structure

```
apps/
  builder/          # Plitzi visual builder (main app)
  sdk/              # Plitzi SDK app
  server/           # Server app
packages/
  sdk-shared/       # Shared ESLint + TSConfig base configs
  sdk-store/        # State management library
  sdk-auth/
  sdk-collections/
  sdk-dev-tools/
  sdk-elements/
  sdk-event-bridge/
  sdk-interactions/
  sdk-navigation/
  sdk-plugins/
  sdk-schema/
  sdk-state/
  sdk-style/
  sdk-variables/
```

## Code Style

### Formatting (Prettier — `.prettierrc`)

- `printWidth`: 120
- `tabWidth`: 2, spaces (no tabs)
- `semi`: true
- `singleQuote`: true
- `trailingComma`: none
- `arrowParens`: avoid (omit parens for single-arg arrows: `x => x + 1`)
- Plugin: `prettier-plugin-tailwindcss`

### Linting (ESLint — `packages/sdk-shared/eslint.config.mjs` as base)

- TypeScript strict mode + `typescript-eslint` strict type-checked rules
- `prefer-const` enforced — never use `let` when value doesn't change
- `no-var` enforced
- `curly` enforced — always use braces for `if`/`else`/`for`/`while` bodies
- `quotes`: single
- `linebreak-style`: unix
- Type imports: always use `import type` when importing only types
- Import order enforced alphabetically: builtin → external → internal (`@plitzi/sdk-*`, `@pmodules/*`, `@pcomponents/*`) → parent/sibling → type
- Always a blank line between import groups (`newlines-between: always`)

### TypeScript (base: `packages/sdk-shared/tsconfig.app.json`)

- `strict: true`, `strictNullChecks: true`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- Target: `ES2023`, module: `ESNext`, moduleResolution: `bundler`
- `isolatedModules: true`
- `emitDeclarationOnly: true` — Vite handles JS output
- `jsx: react-jsx`

## Spacing Conventions

These are enforced by convention, not lint rules:

**After an `if` block**: leave one blank line before the next statement when more code follows.

**Before `return`**: leave one blank line when there is any code above it in the same block.

**Around `useCallback`**: leave one blank line above and below every `useCallback` declaration when there is other code in the same block.

```ts
// Correct
if (condition) {
  doSomething();
}

const result = computeValue();

return result;

// Wrong — missing blank lines
if (condition) {
  doSomething();
}
const result = computeValue();
return result;
```

```tsx
// Correct
const [open, setOpen] = useState(false);

const handleToggle = useCallback(() => setOpen(o => !o), []);

const handleConfirm = useCallback(() => {
  doSomething();
}, [doSomething]);

return <div />;

// Wrong — missing blank lines around useCallback
const [open, setOpen] = useState(false);
const handleToggle = useCallback(() => setOpen(o => !o), []);
const handleConfirm = useCallback(() => {
  doSomething();
}, [doSomething]);
return <div />;
```

## General Rules

- No comments unless the WHY is non-obvious (hidden constraint, workaround, subtle invariant).
- Never explain WHAT the code does — identifiers do that.
- No unused variables, parameters, or imports (enforced by TS + ESLint).
- Prefer `const` over `let`; never use `var`.
- Arrow functions: omit parens for single parameter.
- No trailing commas.
- Semicolons required.
- Always use braces for control flow bodies.
- Use `import type` for type-only imports.
- Avoid `any` in public APIs — only in implementation bodies with `// eslint-disable-next-line`.
- Code in English; conversation in Spanish.
- **Code quality and avoiding tech debt are the top priority** — do not leave shortcuts, hacks, or half-finished implementations.
- **El código debe ser legible y fácil de entender.** Priorizar claridad sobre brevedad. Si una línea o expresión requiere esfuerzo para interpretar, refactorizarla.
- **Type-safe always.** TypeScript strict mode is enabled — every value, parameter, return type, and generic must be properly typed. No `any`, no `as` casts unless there is no alternative (and even then, add a comment explaining why). Let the compiler catch errors, not runtime.

### File & Folder Structure

**Carpeta por componente.** Cada componente vive en su propia carpeta PascalCase. Si el componente tiene sub-componentes, estos van dentro de una subcarpeta `components/` — y cada sub-componente sigue el mismo patrón (su propia carpeta con `index.ts`, etc.):

```
WorkflowNode/
  WorkflowNode.tsx
  index.ts
  WorkflowNode.test.tsx
  WorkflowNode.stories.tsx
  components/
    NodeBody/
      NodeBody.tsx
      index.ts
    NodeHeader/
      NodeHeader.tsx
      index.ts
    ParamBinding/
      ParamBinding.tsx
      index.ts
```

**PascalCase** para archivos y carpetas de componentes y features. Nunca kebab-case ni camelCase para estos.

**`index.ts` como barrel.** Toda carpeta expone un `index.ts`. La estructura mínima es:

```ts
import ComponentName from './ComponentName';

export * from './ComponentName';

export default ComponentName;
```

La primera y tercera línea exponen el default con nombre (para autocompletado en el IDE). La segunda exporta con `*` el resto: tipos, named exports, etc.

**Props type exportado.** Cada componente exporta su tipo de props con el nombre `ComponentNameProps`:

```tsx
export type ButtonProps = {
  label: string;
  onClick: () => void;
};

const Button = ({ label, onClick }: ButtonProps) => { ... };
```

**Tests y stories co-localizados.** `Component.test.tsx` y `Component.stories.tsx` van en la misma carpeta que `Component.tsx`, nunca en una carpeta `__tests__` separada.

### Component Rules

**Split large components.** When a component's render becomes large, break it into smaller focused sub-components. The signal to split is when distinct visual or logical blocks can be named and reasoned about independently — not when a line count is hit. Each sub-component goes in its own folder under `components/` following the same folder-per-component pattern. The parent becomes a thin orchestrator that composes them.

**Máximo 2 niveles de nesting.** Un sub-componente puede tener su propia subcarpeta `components/` con la estructura completa (carpeta + barrel), pero los componentes dentro de ese segundo nivel no pueden tener otra subcarpeta `components/` propia.

```
// Correcto — hasta 2 niveles
ChatMessage/                              ← raíz
  components/
    AIBrandPreview/                       ← nivel 1
      AIBrandPreview.tsx
      index.ts
      components/
        BrandColors/                      ← nivel 2 ✓
          BrandColors.tsx
          index.ts

// Incorrecto — 3 niveles
ChatMessage/
  components/
    AIBrandPreview/                       ← nivel 1
      components/
        BrandColors/                      ← nivel 2
          components/
            ColorSwatch/                  ← nivel 3, NO permitido
```

Exception: tiny sub-components (a few lines, self-contained, no logic) do not need their own folder unless they are reused in multiple places. Inline them or keep them in the same file only when they are trivial and unique to that parent.

**No inline arrow functions in JSX event handlers.** Every event handler must be a named function defined with `useCallback`. Never pass an inline arrow function directly to a JSX prop — it creates a new function on every render and breaks memoization.

```tsx
// Correct
const handleToggle = useCallback(() => setOpen(o => !o), []);
<button onClick={handleToggle} />

// Wrong — inline arrow, new reference every render
<button onClick={() => setOpen(o => !o)} />
<button onClick={() => onSelect(id)} />
```

When rendering a list with `.map()` and each item needs to capture its own value, extract the item into a sub-component that owns its `useCallback` internally:

```tsx
// Wrong — inline arrow capturing loop variable
{items.map(item => (
  <button key={item.id} onClick={() => onSelect(item.id)}>{item.label}</button>
))}

// Correct — sub-component owns the callback
type SelectItemProps = { id: string; label: string; onSelect: (id: string) => void };
const SelectItem = ({ id, label, onSelect }: SelectItemProps) => {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect]);
  return <button onClick={handleClick}>{label}</button>;
};

{items.map(item => (
  <SelectItem key={item.id} id={item.id} label={item.label} onSelect={onSelect} />
))}

**No helpers inside component files.** Extract helper functions, constants, and utilities to a separate file (e.g. `helpers.ts` or a dedicated `helpers/` folder) and import them. A component file should only contain the component itself and its direct types/props.

**No ternaries for rendering complex JSX.** When a ternary renders multi-line or structurally different JSX branches, replace it with explicit `&&` conditionals so the render stays flat and readable. Simple one-liner values (a string, a character, a primitive) may stay as ternaries.

```tsx
// Correct — simple string value, ternary is fine
{open ? '▲' : '▼'}
{isLoading ? 'Loading…' : 'Done'}

// Correct — complex JSX replaced with explicit conditionals
{isLoading && <div className="spinner">...</div>}
{!isLoading && <div className="data">...</div>}

// Wrong — multi-line JSX branches inside a ternary
{isLoading ? (
  <div className="spinner">...</div>
) : (
  <div className="data">...</div>
)}
```

### Styling — Tailwind CSS

Use Tailwind CSS classes for all styling. The `style` prop is only acceptable when the value is truly dynamic or cannot be expressed with Tailwind (e.g. a computed pixel value from JS, a CSS variable set at runtime). Never use `style` as a shortcut to avoid thinking of the right Tailwind class.

```tsx
// Correct
<div className="flex items-center gap-2 rounded-lg bg-white p-4 shadow-md" />

// Correct — dynamic value that can't be a Tailwind class
<div style={{ width: `${computedWidth}px` }} />

// Wrong — use Tailwind instead
<div style={{ display: 'flex', padding: '16px', borderRadius: '8px' }} />
```

### Conditional classNames — clsx

Use `clsx` for conditional `className` composition. Use the object syntax `{}` for the conditional/logic part:

```tsx
// Correct
<div className={clsx('base-class', { active: isActive, disabled: isDisabled })} />

// Also correct — mix string and object
<div className={clsx('base', someVar && 'extra', { highlight: isHighlighted })} />

// Wrong — string concatenation or ternaries in className
<div className={`base-class ${isActive ? 'active' : ''}`} />
```

**No Tailwind string constants.** Never extract a raw Tailwind class string into a constant and reuse it across JSX:

```tsx
// Wrong — opaque string constant shared across JSX
const iconBtn = 'w-6 h-6 grid place-items-center rounded-md cursor-pointer ...';
<button className={iconBtn} />

// Correct — inline the classes directly, use clsx when there is conditional logic
<button className="w-6 h-6 grid place-items-center rounded-md cursor-pointer ..." />
<button className={clsx('w-6 h-6 grid place-items-center rounded-md', { 'opacity-50': disabled })} />
```

If the same set of base classes is genuinely shared, extract it into a proper component instead.

### After-change Verification

After finishing any set of code changes, always run:
1. `yarn typecheck` — fix all TypeScript errors before considering the task done.
2. `yarn lint` — fix all ESLint errors (warnings are acceptable).

## Work Preferences

- Incremental changes: share file → analyze → propose → implement.
- Always confirm the API/interface before implementing changes to it.
- Do not modify anything beyond the target of the change.
- After finishing, update CLAUDE.md with new learnings when applicable.
- Tests: exhaustive edge cases, re-renders, memory leaks, performance.
