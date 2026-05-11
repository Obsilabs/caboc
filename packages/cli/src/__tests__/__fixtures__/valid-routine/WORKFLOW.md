---
workflow: valid_routine
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: A minimal valid workflow used by the lint test suite.
io:
  inputs:
    topic:
      type: string
  outputs:
    summary_md:
      type: string
---

# PROCEDURE

1. Read inputs.topic.
2. USE AGENT echo SESSION fresh WITH inputs={ "topic": "demo" }.
3. Emit outputs.summary_md from the agent reply.
