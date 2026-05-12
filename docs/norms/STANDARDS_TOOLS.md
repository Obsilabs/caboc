# STANDARDS_TOOLS — Tool contracts

> Status: draft v0.1
> Scope: every tool invoked from a routine via `USE TOOL`. Tools are
> typed TypeScript libraries, not LLMs.

## 1. Why this exists

Routines call two kinds of things: **agents** (LLM-driven, declared
under `agents/`) and **tools** (deterministic code libraries, declared
under `tools/`). Tools exist because production workflows need
predictable, type-checked, audit-grade primitives — DB writes, HTTP
calls, signing, encoding — that no LLM should be improvising.

A CABOC tool is a real npm package (workspace or registry) with a
`TOOL.md` manifest pinned to its compiled `.d.ts`. The manifest is the
contract; the package is the implementation. Drift between them fails
the build, not the run.

This norm fixes that contract.

## 2. Body grammar

Routines invoke tools via a single statement form added to the
`PROCEDURE` body grammar of `STANDARDS_ROUTINES` §3:

```
USE TOOL <pkg>.<export>[.<method>] WITH inputs={...} [IDEMPOTENT BY <expr>] .
```

- `<pkg>` — the tool's short name as installed in `caboc.config.json`
  (`tools.<pkg>`), not the npm package name.
- `<export>` — a top-level named export of the tool (class or
  function), validated against `dist/index.d.ts`.
- `<method>` — required when `<export>` is a class; omitted for free
  functions.
- `inputs={...}` — object literal whose shape must satisfy the typed
  parameter of the export, also checked against `.d.ts`.
- `IDEMPOTENT BY <expr>` — sugar that materializes
  `idempotency_key := sha256(<expr>)` and threads it through `inputs`.
  Mandatory when the export declares `required_idempotency_key: true`.

The call's return value binds via the surrounding `LET` form:

```
LET customer := USE TOOL stripe.CustomerService.create
  WITH inputs={ email: $input.email, name: $input.name }
  IDEMPOTENT BY $input.email .
```

## 3. TOOL.md frontmatter shape

Every tool root contains a `TOOL.md` whose frontmatter is the
machine-readable contract.

```yaml
---
tool: <kebab-case-id>
version: <semver>
spec_version: caboc-llm/0.1.0
description: <one paragraph, prose>
maintainer: <email-or-handle>

package_ref:
  type: workspace | registry
  name: '@<org>/<pkg>'         # npm package identifier
  path: 'src/index.ts'         # source of truth
  dist: 'dist/index.js'        # consumed at runtime
  types: 'dist/index.d.ts'     # consumed by USE TOOL validator

exports:
  - name: <PascalCaseClass | camelCaseFn>
    kind: class | function
    determinism_default: deterministic-pure | deterministic-read | non-deterministic-write
    methods:                    # present iff kind=class
      - name: <camelCase>
        inputs: { <field>: { type: <t>, ... } }
        outputs: { <field>: <t> | enum: [...] }
        determinism: deterministic-pure | deterministic-read | non-deterministic-write
        side_effects: [ reads:..., writes:... ]
        required_idempotency_key: true | false

infra_requirements:
  required_secrets:
    - name: <id>
      type: bearer_token | api_key | private_key | username_password
      scope: workspace | tenant | run
      rotation_days: <int>
      audit: every_access | sampled | none
  required_config:
    - name: <id>
      type: string | integer | boolean
      default: <value>
  network_egress: [ '<host>:<port>', ... ]   # closed allowlist
  filesystem_access: [ '<glob>', ... ]       # closed allowlist, optional

attestation:
  content_hash: sha256-<...>
  signing: <did-or-key-id>

visibility: workspace | tenant | public
publishable: true | false
---
```

Example (abridged, for a `stripe` tool):

```yaml
---
tool: stripe
version: 1.0.0
spec_version: caboc-llm/0.1.0
package_ref: { type: workspace, name: '@acme-tools/stripe',
               path: 'src/index.ts', dist: 'dist/index.js',
               types: 'dist/index.d.ts' }
exports:
  - name: CustomerService
    kind: class
    methods:
      - name: create
        inputs: { email: { type: string, format: email }, name: { type: string } }
        outputs: { id: string, default_payment_method: string | null }
        determinism: non-deterministic-write
        side_effects: [ writes:network:api.stripe.com ]
        required_idempotency_key: true
infra_requirements:
  required_secrets: [ { name: api_key, type: bearer_token, scope: workspace,
                        rotation_days: 365, audit: every_access } ]
  network_egress: [ 'api.stripe.com:443' ]
visibility: workspace
publishable: false
---
```

The body of `TOOL.md` is human prose: determinism rationale,
compensation hooks, operational notes.

## 4. Package layout

```
tools/<name>/
├── TOOL.md                manifest (mandatory)
├── package.json           workspace or publishable npm package
├── src/
│   └── index.ts           source of truth for exported types
├── dist/
│   ├── index.js           compiled, consumed at runtime
│   └── index.d.ts         types, consumed by USE TOOL validator
└── tsconfig.json
```

`package.json` MUST declare `main`, `types`, and an `exports` map that
matches `package_ref.dist` / `package_ref.types`.

The runtime never reads `src/`. The validator never reads `dist/index.js`.
Both read `TOOL.md` + `dist/index.d.ts` and require them to agree.

## 5. Determinism contract

Every method declares one of three levels:

| Level                      | Allowed I/O                                                    | Replay semantics                                                  |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `deterministic-pure`       | none — pure compute                                            | Re-execute on replay; output must be byte-equal.                  |
| `deterministic-read`       | reads only (DB, HTTP GET, FS read on allowlist)                | Replay from witness cache; runtime MAY re-fetch if cache missing. |
| `non-deterministic-write`  | writes (DB INSERT/UPDATE, HTTP POST, message send, FS write)   | Replay returns the recorded result; never re-executes.            |

The runtime tags each invocation with its declared level. A
`deterministic-pure` method that performs I/O at runtime fails with
`CABOC_E_TOOL_DETERMINISM_VIOLATION`.

Between **dev** and **prod**: dev runs MAY re-execute `deterministic-read`
calls; prod runs MUST replay from witness when the witness is present.

## 6. Idempotency

When a method declares `required_idempotency_key: true`, the call site
MUST supply a stable key:

- explicit form: `inputs.idempotency_key = <expr>`
- sugar form: `IDEMPOTENT BY <expr>` (runtime computes
  `sha256(<expr>)` and injects it)

Omitting the key fails the call at `caboc lint`, not at run time. The
key is the de-duplication unit the runtime uses to deliver
exactly-once semantics across retries and replays.

## 7. Sandbox

Every tool runs inside an in-process sandbox configured from its
`infra_requirements`:

- **Egress**: only hosts in `network_egress` are reachable; any other
  destination raises `CABOC_E_TOOL_EGRESS_DENIED`.
- **Filesystem**: only globs in `filesystem_access` are readable /
  writable; anything else raises `CABOC_E_TOOL_FS_DENIED`.
- **Determinism**: any actual I/O during a `deterministic-pure`
  method, or any write during a `deterministic-read` method, raises
  `CABOC_E_TOOL_DETERMINISM_VIOLATION`.

The sandbox is enforced by an injected `fetch` and a wrapped `fs`
module passed in via the factory; tools MUST NOT import the raw
`node:fs` or `globalThis.fetch`.

## 8. Secrets

Secrets are declared in `infra_requirements.required_secrets` and
resolved per workspace via `caboc.config.json`:

```json
{
  "tools": {
    "stripe": {
      "secrets": { "api_key": "${env:STRIPE_API_KEY}" },
      "config":  { "apiVersion": "2024-11-20" }
    }
  }
}
```

At boot, the runtime resolves every entry, calls the tool's factory
once per workspace, and discards the literal:

```ts
const stripe = createStripeTool({
  secrets: { api_key: resolved.api_key },
  config:  { apiVersion: resolved.apiVersion },
  fetch:   sandboxedFetch,
});
```

Forbidden:

- Reading `process.env` from inside a tool. The validator scans for
  `process.env` references in `dist/index.js` and fails the build.
- Embedding secret literals in routine source, `TOOL.md`, or `package.json`.
- Logging the resolved secret object. See `STANDARDS_SECURITY` §4.

## 9. Validator

`caboc lint` extends to tools:

1. Parse every `USE TOOL <pkg>.<export>[.<method>]` reference in every
   routine.
2. Resolve `<pkg>` against `caboc.config.json.tools`.
3. Load the tool's `TOOL.md` and `dist/index.d.ts`.
4. Cross-check: every `exports[].name` and `methods[].name` in TOOL.md
   MUST exist as a typed symbol in `.d.ts` with matching arity. Drift
   raises `CABOC_E_TOOL_MANIFEST_DRIFT`.
5. Cross-check the call site: `inputs={...}` MUST satisfy the
   parameter type; output binding sites MUST be assignable from the
   return type.
6. For each invocation, verify `required_idempotency_key` is supplied.
7. v0.3+: emit typed binding glue (a `.cabocgen/<pkg>.ts` file) so
   editors get full IntelliSense on `USE TOOL` call sites.

## 10. Step-modifier compatibility

`STANDARDS_ROUTINES` §3 step modifiers constrain which tools may be
called:

| Step modifier          | Allowed determinism levels                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| `DETERMINISTIC`        | `deterministic-pure`, `deterministic-read`                              |
| `NON_DETERMINISTIC`    | all three                                                               |
| `HITL`                 | inherits surrounding step's level                                       |
| `COMPENSATABLE`        | all three; writes MUST pair with a `DEFER` block invoking a compensator |
| `PRIVATE`              | all three; outputs subject to witness redaction (v0.2+)                 |

A `STEP DETERMINISTIC` that calls a `non-deterministic-write` method
fails with `CABOC_E_TOOL_STEP_INCOMPATIBLE`.

## 11. Reuse of existing examples

Six proven tool implementations live under
`spikes/scenarios-caboc/_shared/tools/` and are the canonical shape
for new tools:

- `stripe/` — third-party HTTP API, write-heavy, idempotency-key
  enforced on every write method.
- `postgres/` — workspace data store, typed repos with reads + writes,
  idempotency-key on writes.
- `sendgrid/` — outbound mail, single non-deterministic write per send.
- `s3-storage/` — object storage with deterministic-read on `head`,
  non-deterministic-write on `put`.
- `hubspot/` — third-party CRM, mixed read/write surface.
- `docusign/` — long-running e-signature; reads are
  `deterministic-read`, the create call is `non-deterministic-write`.

Mirror their `TOOL.md` shape, package layout, and factory signature
when authoring a new tool. Divergence is allowed only when the norm
above explicitly permits it.

## 12. Cross-references

- `STANDARDS_NAMING` §6 — tool short names and npm package naming.
- `STANDARDS_LICENSING` — Apache 2.0 applies to every tool source tree.
- `STANDARDS_ROUTINES` §3 — body grammar host for `USE TOOL`.
- `STANDARDS_SECURITY` §4 — secret handling, audit events.
- `STANDARDS_DISTRIBUTION` — tools distribute via the same content-hash
  + lockfile mechanism when published.

## 13. Forbidden

- LLM model literals anywhere in a tool source tree, TOOL.md included.
- `process.env` reads in tool code.
- Network egress to a host outside `network_egress`.
- Filesystem access outside `filesystem_access`.
- A tool that exports a method but omits it from `TOOL.md.exports`, or
  vice versa.
- Mutating `TOOL.md` without bumping `version:` per `STANDARDS_RELEASES`.
