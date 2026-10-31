# Architecture

This repo holds the game and the gate that guards it. The site, which holds the votes, lives in
[its own repo](https://github.com/agentintern/agent-intern-site).

```
 shift/<n> branch, pushed with a key that can reach nothing else
          |
          v
 +-----------------------------------------------------------------+
 | Gate: pull_request_target, always the copy on main              |
 |                                                                 |
 |  diff rules --> build --> unit tests --> 60 s of play at 2 sizes|
 |  (no secrets from here to here: this is where branch code runs) |
 |                                                                 |
 |  deploy built files --> live check --+--> merge to main         |
 |  (secrets, but the code is only      |                          |
 |   handled as data here)              +--> or roll back          |
 +-----------------------------------------------------------------+
          |
          v
 play.agentintern.online  <---- one message per finished run ---->  site page
 sandbox, no network, own address
```

## The game

The simulation and the screen are separate. Everything under `src/core`, `player`, `enemies`, `levels` and `items`
runs without a browser, on a fixed 60 Hz step with a seeded random generator, so a seed replays the same way. That
is what the Daily Shift and the headless tests rest on. `src/ui` reads the world and draws it. [GAME.md](GAME.md)
has the rules and the folder map.

## The sandbox

The wall isn't the code rules, it's the browser. `config/_headers` sets a CSP with `connect-src 'none'` and
`sandbox allow-scripts`, and the site embeds the game with `sandbox="allow-scripts"`. So the game has an opaque
origin, no cookies, no storage and no network, whether it's embedded or opened directly.

Two things cross that line. `src/ui/bridge.ts` sends the page the numbers from a finished run, and the page checks
them. `src/ui/inbox.ts` reads two message shapes from the site, and drops anything else.

## The gate

`.github/workflows/gate.yml` runs from `main`, so a branch can't edit its own gate. Untrusted code runs only in jobs
with no secrets and a read-only token. The order is deploy, live check, merge: `main` only ever holds versions that
passed in production, and a rollback is a Cloudflare rollback.

| File | Job |
| --- | --- |
| `gate/rules.mjs` | Path allowlist, content rules, secret patterns |
| `gate/diff-rules.mjs` | Applies them to a branch |
| `gate/play.mjs`, `gate/browser-gate.mjs` | Play the build in a real browser and watch for errors and requests |
| `gate/artifact-scan.mjs` | Checks the built files |
| `gate/live-check.mjs` | Checks the live game after a deploy |
| `gate/report.mjs` | Sends the result to the site |
