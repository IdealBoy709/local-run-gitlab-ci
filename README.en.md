# local-run-gitlab-ci

Run `.gitlab-ci.yml` scripts locally. `local-run-ci init` scaffolds a ready-to-run `local-build/` directory with runner, plugins, and defaults.

## Quick Start

```bash
# Generate local-build in the current project
npx local-run-ci init

# Overwrite existing local-build
local-run-ci init --force

# Run (same as: node ./local-build)
local-run-ci --list
local-run-ci --only-stages test
local-run-ci run --dry-run
```

> The template lives in `resources/local-build/`; `init` copies it into your working directory.

## Features

- Single entry: `node ./local-build` (`local-build/index.js`).
- Executes `.gitlab-ci.yml` `script` steps in `stages` order.
- Colored stdout/stderr logging.
- Skip controls: `--skip`, `--skip-re`, and `local-build/.ci-ignore`.
- `init` generates `local-build/.ci-ignore` by default (editable).
- Plugin hooks via `local-build/plugins/` (see `local-build/plugins/README.md`).
- Dependencies: `shelljs@^0.8.5`, `yaml@^2.3.4`. `init` installs them unless `--skip-install` is used.

## Commands

- `local-run-ci init [-f|--force] [--skip-install]`  
  Generate/overwrite `local-build/`; optionally skip dependency installation.
- `local-run-ci run ...args`  
  Explicitly run the local runner, passing through args.
- `local-run-ci ...args`  
  Without subcommands, forwards args to the local runner (supports `--list`, `--dry-run`, `--only-stages`, `--only-jobs`, `--skip`, `--skip-re`, etc.).

## Plugins

Add plugins under `local-build/plugins/` and enable them in `local-build/index.js`. Available hooks are documented in `local-build/plugins/README.md`.

Built-ins:
- `pre-env.js`: sets `CI` env.
- `post-summary.js`: prints run/skip/fail stats.

## Example

A full example lives in `example/`:

```bash
cd example
node ./local-build --list
node ./local-build --dry-run
```
