# Threat model

What could go wrong in this repo, and what stops it. No outside review has checked this. The site has
[its own](https://github.com/agentintern/agent-intern-site/blob/main/docs/THREAT-MODEL.md).

## What we protect

Visitors to the site, the production secrets used by the gate, and `main`, which should only hold versions that
passed.

## The attacker

Assume the code in a shift branch is hostile. It was written by a model reading text from a stranger.

| Attack | What stops it | If that fails |
| --- | --- | --- |
| The game calls out to a server | Content rules | `connect-src 'none'`, which a shift can't change |
| The game reads a visitor's session | The sandbox gives it an opaque origin | The cookie is `__Host-`, and writes need an exact `Origin` |
| The game loads another script | `script-src` allows only its own files | The sandbox |
| The game sends fake messages to the page | The page checks the sender and copies only validated numbers | Scores are casual, and carry no value |
| A shift edits the gate | `pull_request_target` runs the copy on `main` | The path allowlist fails the change |
| A shift edits the headers, a dependency or the build | The path allowlist | The artifact scan looks at the built files |
| Branch code steals a deploy secret | Branch code runs only in jobs with no secrets | Secret jobs treat the build as data and never run it |
| A build passes and breaks live | The live check after each deploy | Automatic rollback |
| A shift pushes to `main` | The key can only reach `shift/*`, enforced by a ruleset with no bypass | Pull requests are the only way in |
| A secret is committed | The scan in the diff rules | The repo has no secrets to copy |

## What this doesn't protect against

- **A person approving a bad change.** The person at the keyboard is part of the model.
- **The content rules being evaded.** Regexes can't fully police JavaScript. The CSP and sandbox are the wall.
- **A game that's bad but harmless.** A task can make the game worse without breaking any rule.
- **A fake high score.** A browser can always lie. The site rejects impossible numbers and nothing more.
- **Bugs in a browser sandbox, in GitHub, or in Cloudflare.**
