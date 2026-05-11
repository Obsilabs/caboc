# STANDARDS_CODE — TypeScript code style

> Status: draft v0.1
> Scope: every TypeScript source file in every CABOC package.

## 1. TypeScript baseline

`tsconfig.base.json` (extended by every package):

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  }
}
```

Per-package `tsconfig.json` extends this and adds `outDir`, `rootDir`,
`include`, `exclude`. No package overrides `strict` to `false`. No
package disables a flag in §1 — only adds further strictness.

## 2. Formatting — Biome 2.x

`biome.json` at the repo root:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.13/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 1,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  }
}
```

Run `pnpm format` to apply, `pnpm lint` to check.

## 3. Module conventions

- **ESM only**. `"type": "module"` in every `package.json`.
- Node built-ins use the `node:` prefix: `node:fs/promises`, `node:path`,
  `node:crypto`.
- Path aliases discouraged; use relative imports inside a package and
  the package name across packages.
- No barrel re-exports of internal modules (only `index.ts` at the
  package root is allowed to re-export the public API).

## 4. Type discipline

- No `any`. Use `unknown` and narrow with Zod or type guards.
- Validate at boundaries (CLI args, file reads, network responses) with
  Zod. Inside the boundary, types are trusted.
- Prefer `type` aliases over `interface` for object types unless you
  need declaration merging.
- Export types separately from values: `import type { X } from "./y"`
  enforced by `verbatimModuleSyntax`.

## 5. Async + errors

- Async functions return `Promise<T>` explicitly when the inferred type
  is non-obvious.
- Throw `Error` subclasses with a stable `code` string for programmatic
  matching: `throw new CabocError("CABOC_E_ROUTINE_NOT_FOUND", "...")`.
- Never `catch { ... }` without re-throwing or logging the cause.
- Avoid unhandled rejections; every top-level `await` in a CLI entry
  point must be inside a `try/catch`.

## 6. Naming inside source

| Kind                   | Convention                                                          |
| ---------------------- | ------------------------------------------------------------------- |
| Function, variable     | `camelCase`                                                         |
| Type, interface, class | `PascalCase`                                                        |
| Constant (frozen)      | `SCREAMING_SNAKE_CASE` only for true compile-time constants         |
| Type parameter         | Single uppercase letter (`T`, `K`, `V`) or `PascalCase` if meaningful |
| File                   | `kebab-case.ts` (see `STANDARDS_NAMING.md` §3.1)                    |

## 7. Comments

- Default to **no comments**. Code that reads well does not need them.
- A comment is justified when it documents a non-obvious constraint, a
  workaround for a specific bug (link the bug), or a subtle invariant.
- TODO comments must include a date and an issue link:
  `// TODO(2026-05-15, #123): unify with the new resolver`.
- No commented-out code. Delete it; git remembers.

## 8. Tests live next to source

- `src/foo.ts` is tested by `src/foo.test.ts` in the same directory.
- Cross-cutting integration tests go under `src/__tests__/`.
- Fixtures go under `__fixtures__/` next to the test that uses them.

## 9. The `caboc lint` denylist applies to source too

A source file that contains a literal LLM model name (`claude-`, `gpt-`,
`gemini-`, `mistral-`, `llama-`, `opus`, `sonnet`, `haiku`) fails the
lint check, even if the string is inside a comment or a test fixture.
Use placeholders (`<model>`) or rely on the runtime capability
abstraction.
