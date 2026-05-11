---
name: echo
description: Minimal echo agent for tests.
capabilities:
  - text.generation
inputs:
  topic:
    type: string
outputs:
  summary_md:
    type: string
---

You are an echo agent. Restate the topic as a short markdown paragraph.
