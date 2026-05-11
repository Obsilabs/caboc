# STANDARDS_TESTS — Testing conventions

> Status: draft v0.1
> Scope: every test in every CABOC package.

## 1. Stack

- **Runner**: Vitest (latest 2.x).
- **Assertions**: built-in `expect` API (no Chai).
- **Coverage**: `vitest run --coverage` reports v8.
- **Mock LLM**: deterministic fake provider (no network calls in tests).

## 2. File layout

- Unit test of `src/foo.ts` lives at `src/foo.test.ts` (sibling).
- Cross-cutting integration tests live under `src/__tests__/`.
- Fixtures live under `__fixtures__/` next to the test that uses them.
- No `.spec.ts` suffix anywhere.

## 3. Naming

- `describe("functionName", () => { ... })` matches the exported symbol.
- `it("does X when Y", () => { ... })` reads as English sentence.
- One `expect` per `it` when feasible; multiple `expect`s allowed when
  asserting different facets of one logical assertion.

## 4. Coverage targets

| Layer                 | Target line coverage |
| --------------------- | -------------------- |
| Pure functions        | 95%                  |
| Boundary parsers      | 95%                  |
| CLI entry / dispatch  | 80%                  |
| Build scripts         | not required         |

CI enforces a baseline of 80% for any package under `packages/`.

## 5. Test categories

### 5.1 Unit

Pure function, no I/O. Fast. The default kind. Should be runnable in
milliseconds and parallelizable.

### 5.2 Boundary / parser

Parse a sample input (`__fixtures__/*.md` for frontmatter, `*.json` for
inputs), assert the parsed shape. Add a fixture file every time a
real-world example surprises the parser.

### 5.3 Snapshot

Used for codegen outputs and CLI help text. Snapshots live in
`__snapshots__/` next to the test. Snapshot diffs **must** be reviewed
in PR — never blindly `vitest -u`.

### 5.4 LLM-runtime integration

A test that exercises a full routine using the **deterministic fake LLM
provider**. The fake reads a per-test scripted response table keyed by
`(agent-id, inputs-hash)` and replays canned JSON. No network calls.

## 6. Forbidden patterns

- Sleeps. If a test needs to wait, use vi fake timers or refactor the
  code under test.
- Conditional assertions (`if (x) expect(...)`). Either the case
  matters and gets its own `it`, or it does not exist.
- `try { ... } catch { /* ignore */ }` inside tests. Always assert the
  error shape with `expect(...).toThrow(/regex/)`.
- Real network or filesystem calls outside `__fixtures__/`. Use
  in-memory equivalents.
- Tests that mutate global state without resetting it in `afterEach`.

## 7. Determinism

- Tests must pass on first run and on every subsequent run with the
  same git commit. No flaky tests are tolerated; one flake = quarantine
  ticket within 24 hours.
- Random data must use a seeded RNG. Time must use vi fake timers.

## 8. Fixtures for routines

Each example routine ships:

- `__fixtures__/sample-inputs.json` — a representative valid input.
- `__fixtures__/expected-outputs.json` — the reference output shape
  (used for conformance assertions, not strict equality).

A future `caboc conformance` command will replay every fixture through
a configured runtime and compare.

## 9. CI command

```
pnpm -r test
```

Runs every package's tests in parallel. Fails the build on any test
failure or on coverage below the package threshold.
