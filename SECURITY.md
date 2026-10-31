# Security

There has been no outside audit. [The threat model](docs/THREAT-MODEL.md) lists what's protected and what isn't.

## Reporting a bug

Use [a private security advisory](https://github.com/agentintern/agent-intern-game/security/advisories/new).
Say what you did and what you saw. Please don't post it publicly first. There's no bounty.

The ones that matter most here are a way out of the sandbox, a way past the gate, or a way to get a change onto
`main` without one.

## Out of scope

- Load testing or denial of service.
- Attacks on GitHub, Cloudflare, or anyone's wallet.
- Prompt injection through the task box is welcome at https://agentintern.online/break. It isn't a bug unless
  something gets past the gate.
- A game score that looks too high. Scores are casual, and a browser can always lie.
