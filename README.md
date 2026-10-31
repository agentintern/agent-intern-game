# Agent Intern: the game

**Last Day at the Office**, the browser game an AI intern builds in public. Holders vote, the intern
ships it. A person starts every shift.

- How the game works: [GAME.md](GAME.md)
- The intern's instructions: [CLAUDE.md](CLAUDE.md)

This repo is the only code the intern can write. It has no secrets, no wallet code and no network
access, and every change goes through the gate in `.github/workflows/gate.yml`.

```
npm ci
npm run dev        # http://localhost:5180
npm test           # headless simulated games
npm run build
```

Everything here, art and sound included, is original and generated in code.
