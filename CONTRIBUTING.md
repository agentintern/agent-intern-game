# Contributing

A person maintains this project, and Claude Code writes much of the code.

- Game changes come from the board at https://agentintern.online/board, or from the team, labeled as a team change.
- This repo takes pull requests from `shift/*` branches only, and a ruleset enforces that. Open an issue instead.
- Every game change goes through the gate. It fails any change outside `src/`, `tests/` and `GAME.md`.
- Art and sound are made in code, and everything has to be original.
- There's no reward of any kind for contributing.

Before a change, run `npm test`, `npm run typecheck` and `npm run build`.

## Maintenance pull requests

Team work on docs, CI and the gate uses a `shift/maintenance-*` branch.

- The gate skips these branches, so they can't deploy or merge anything.
- `maintenance.yml` runs the type check, unit tests, gate tests, a diff check and a secret scan. The diff check fails
  anything that touches `src/`, `tests/`, `GAME.md` or `public/`, because those only change through a shift.
- A person reads the diff and merges it. Nothing merges these on its own.
