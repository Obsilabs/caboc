#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { argv, stderr, stdout, exit } from "node:process";

const HELP = `caboc — CABOC routine CLI

Usage:
  caboc init <routine-name>                    Scaffold a new routine.
  caboc lint <routine-dir>                     Validate frontmatter, refs, and denylist.
  caboc add <source>[@ref][#subpath]           Install a routine from git / HTTPS / local path.
  caboc list                                   List installed routines and aliases.
  caboc remove <alias>                         Uninstall a routine.
  caboc run <alias|routine-dir> --inputs <f>   Print the runtime prompt for an LLM.
  caboc inspect <run-dir>                      Pretty-print a past run.

Flags:
  -h, --help        Show this help.
  -v, --version     Print version.
`;

async function main(): Promise<number> {
  const args = argv.slice(2);
  const first = args[0];

  if (!first || first === "-h" || first === "--help" || first === "help") {
    stdout.write(HELP);
    return 0;
  }

  if (first === "-v" || first === "--version" || first === "version") {
    // Kept in sync with package.json manually.
    stdout.write("0.2.0\n");
    return 0;
  }

  const rest = args.slice(1);

  switch (first) {
    case "init": {
      const mod = await import("./cmd-init.js");
      return mod.run(rest);
    }
    case "lint": {
      const mod = await import("./cmd-lint.js");
      return mod.run(rest);
    }
    case "add": {
      const mod = await import("./cmd-add.js");
      return mod.run(rest);
    }
    case "list":
    case "ls": {
      const mod = await import("./cmd-list.js");
      return mod.run(rest);
    }
    case "remove":
    case "rm": {
      const mod = await import("./cmd-remove.js");
      return mod.run(rest);
    }
    case "run": {
      const mod = await import("./cmd-run.js");
      return mod.run(rest);
    }
    case "inspect": {
      const mod = await import("./cmd-inspect.js");
      return mod.run(rest);
    }
    default:
      stderr.write(`caboc: unknown command '${first}'\n\n`);
      stderr.write(HELP);
      return 1;
  }
}

main()
  .then((code) => exit(code))
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.write(`caboc: ${msg}\n`);
    exit(1);
  });
