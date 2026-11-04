# Browser checks (Playwright)

End-to-end scripts that drive the real app in Chromium. They expect:

- the dev server: `npx vite --port 5173` (from `app/`)
- for pairing tests, the local relay: `node workers/relay/dev-server.mjs` (port 8787)
- Playwright importable from `/opt/node22/lib/node_modules/playwright` (the cloud
  environment's copy; change the first import on another machine)

Screenshots go to `app/e2e/shots/`, crawl reports to `app/e2e/reports/`
(both git-ignored). Override with `SHOTS=`, `APP_URL=`, `RELAY_URL=`.

| Script | Checks |
|---|---|
| `crawl.mjs <locale> <natural\|pill> <depth>` | Clicks every control on every reachable screen in a fresh app each time; reports controls that change nothing, page errors, and axe violations |
| `onboarding.mjs` | Owner onboarding (terms gate, name), greeting, guide and each Show me, About → legal, the re-consent gate, partner consent |
| `pair.mjs` | Two phones pair through the relay; 4 words match; private data never reaches the partner; pause; stop sharing |
| `lock.mjs` | Wrong-PIN wait survives restart; correct PIN unlocks and resets |
| `method.mjs` | Pill chosen in onboarding → Today asks to finish → pack day shows, one clean record |
| `restore.mjs` | Export plain and passphrase-locked, wipe, restore both; wrong passphrase message |
| `doc.mjs <locale>` | Doctor summary on screen and as a PDF |
| `bigtext.mjs <scale>` | Simulates large system text and checks for overflow |
| `cal.mjs` | Calendar axe check and arrow-key navigation |
| `art.mjs` | Articles list, search, reader, axe |

A clean crawl reads `0 errors, axe on 0 screens`; the only "no-effect"
controls should be re-tapping the tab you're already on.
