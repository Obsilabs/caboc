# STANDARDS_PROVIDER_ROLES — Provider role mapping

> Status: draft v0.2
> Scope: the layer of capability resolution that maps a routine's
> agent roles onto `(capability, tier, constraints)` triples —
> without ever naming a concrete model in the routine source.
> License: Apache 2.0.

## 1. Why this exists

A non-trivial workflow has many distinct agent roles. The
article-forge routine alone has eight: scout, decomposer, planner,
collector, writer, reviewer, polisher, analyst. Each wants a different
capability/tier — fast structured output for the scout, a deep tier
with a large context window for the writer, cheap fast reasoning for
the collector, determinism for the reviewer.

Hard-coding model names in agent frontmatter would couple routine
source to a specific infra deployment. Sprinkling `(capability, tier)`
pairs in every agent would force duplication. The role abstraction
fixes both: a routine names roles; the workspace config maps roles to
`(capability, tier, constraints)`; the runtime resolves at install
time and freezes into the lockfile.

## 2. Role naming

Kebab-case. Two scopes:

- **Workflow-scoped**: `<workflow>-<role>` — e.g. `forge-scout`,
  `forge-writer`, `triage-classifier`. Preferred.
- **Global**: `<role>` — e.g. `summarizer`, `classifier`. Used when a
  workspace shares a role across many routines.

Role identifiers MUST match the alias shape in `STANDARDS_NAMING` §4:
lowercase, kebab-case, no leading digits, no `caboc-` prefix.

## 3. `caboc.config.json.roles` shape

```jsonc
{
  "roles": {
    "forge-scout": {
      "capability": "reasoning",
      "tier": "fast",
      "constraints": {
        "supports_structured_output": true,
        "max_latency_ms": 30000
      }
    },
    "forge-writer": {
      "capability": "reasoning",
      "tier": "deep",
      "constraints": {
        "min_context_tokens": 200000,
        "supports_structured_output": true
      }
    },
    "forge-collector": {
      "capability": "reasoning",
      "tier": "fast"
    }
  }
}
```

- `capability` / `tier` come from the closed sets in
  `STANDARDS_GRAMMAR`.
- `constraints` is an open dict of capability-specific filters;
  unknown keys are ignored by the runtime.
- No `model:`, no `provider:`, no version literal. Any of those →
  `CABOC_E_ROLE_MODEL_LITERAL_FORBIDDEN`.

## 4. Agent frontmatter with `provider_role`

```yaml
---
agent: scout
provider_role: forge-scout
io:
  inputs:
    subject: { type: string }
  outputs:
    candidates: { type: array }
---
```

- When `provider_role` is set, `session.capability` and
  `session.tier` are not required — the runtime resolves from the
  role. They MAY be set as explicit overrides.
- `provider_role` MUST reference a declared role. Missing →
  `CABOC_E_ROLE_NOT_CONFIGURED`.

## 5. Resolution order

For each agent invocation, last-wins:

1. The agent's `provider_role` — role defaults.
2. The agent's explicit `session.capability` / `session.tier` /
   `session.constraints` (override).
3. The call-site override (see §6).

The resolved triple is handed to the provider router, which picks a
concrete `(provider, model, version)`. The router's choice is opaque
to the routine source.

## 6. Override per call

A workflow step may override the role for a single invocation:

```
USE AGENT scout WITH inputs={...} PROVIDER_ROLE forge-scout-fast
```

The override role MUST exist in `caboc.config.json.roles`. The
override is scoped to that invocation and logged as
`agent.role_override` in the transcript.

## 7. Lockfile snapshot

At install time the runtime resolves every role referenced by the
routine and freezes the result into `routines.lock`:

```jsonc
{
  "routines": {
    "article-forge": {
      "roles": {
        "forge-scout":     { "provider": "<p>", "model": "<m>", "version": "<v>" },
        "forge-writer":    { "provider": "<p>", "model": "<m>", "version": "<v>" },
        "forge-collector": { "provider": "<p>", "model": "<m>", "version": "<v>" }
      }
    }
  }
}
```

- The lockfile is the **only** place a concrete model identifier
  appears.
- Replay uses the frozen triple even if `caboc.config.json` changes.
- `caboc update` re-resolves and surfaces diffs, mirroring the TOFU
  flow in `STANDARDS_DISTRIBUTION` §6.

## 8. Subroutine inheritance

A sub-workflow inherits the parent workspace's role mapping unless
the sub-routine ships its own `caboc.config.json` with overlapping
role names. Sub-routine declarations shadow the parent's for the
duration of the sub-call; they do not mutate the parent's lockfile.

Cross-workspace replay therefore ships both lockfiles, or pins both
via the distribution lockfile.

## 9. NEVER name a model

The routine source MUST NOT contain a model identifier, anywhere:

- Not in `WORKFLOW.md` frontmatter.
- Not in agent frontmatter.
- Not in `caboc.config.json.roles`.
- Not in output declarations or scratch configs (shared rule with
  `STANDARDS_OUTPUTS` §11).

`caboc lint` rejects violations at install time, not at run time. The
lockfile is the audit surface; the source stays portable.

## 10. Error codes

| Code                                  | Cause                                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| `CABOC_E_ROLE_NOT_CONFIGURED`         | Agent references a `provider_role` not in `caboc.config.json`|
| `CABOC_E_ROLE_CAPABILITY_MISMATCH`    | Agent demands a capability the role's tier cannot satisfy    |
| `CABOC_E_ROLE_MODEL_LITERAL_FORBIDDEN`| Role definition contains a model/provider literal            |
| `CABOC_E_ROLE_OVERRIDE_UNKNOWN`       | Call-site `PROVIDER_ROLE` names an undeclared role           |

## 11. Example — article-forge

Eight roles, each pinned in the lockfile. The routine source names
only the role; the workspace config names `(capability, tier,
constraints)`; the lockfile freezes the resolved triple:

```jsonc
// caboc.config.json (workspace)
{
  "roles": {
    "forge-scout":      { "capability": "reasoning", "tier": "fast" },
    "forge-decomposer": { "capability": "reasoning", "tier": "fast",
                          "constraints": { "supports_structured_output": true } },
    "forge-planner":    { "capability": "reasoning", "tier": "deep" },
    "forge-collector":  { "capability": "reasoning", "tier": "fast" },
    "forge-writer":     { "capability": "reasoning", "tier": "deep",
                          "constraints": { "min_context_tokens": 200000 } },
    "forge-reviewer":   { "capability": "reasoning", "tier": "deep",
                          "constraints": { "supports_structured_output": true } },
    "forge-polisher":   { "capability": "reasoning", "tier": "fast" },
    "forge-analyst":    { "capability": "reasoning", "tier": "deep" }
  }
}
```

Agent frontmatter only names the role:

```yaml
---
agent: writer
provider_role: forge-writer
io: { inputs: {...}, outputs: {...} }
---
```

`routines.lock` records the frozen `(provider, model, version)` for
every role at install time; replay is deterministic across machines
and across subsequent config edits.

## 12. References

- `STANDARDS_GRAMMAR` — `capability` / `tier` closed sets and the
  `provider_role` field on agent frontmatter.
- `STANDARDS_ROUTINES` — agent frontmatter validation surface.
- `STANDARDS_DISTRIBUTION` §5–§6 — lockfile shape, TOFU, hash
  comparison flow reused for role re-resolution.
- `STANDARDS_NAMING` §4 — role identifier shape.
- `STANDARDS_SECURITY` §5 — provider router posture and credential
  scoping.
