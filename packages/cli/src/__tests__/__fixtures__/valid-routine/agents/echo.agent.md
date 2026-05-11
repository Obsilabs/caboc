---
agent: echo
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: Minimal echo agent for tests.
session:
  capability: reasoning
  tier: fast
  allowed_modes: [fresh]
io:
  inputs:
    topic:
      type: string
  outputs:
    summary_md:
      type: string
---

You are an echo agent. Restate the topic as a short markdown paragraph.
