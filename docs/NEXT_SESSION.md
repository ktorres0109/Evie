# Next session: start here

Where Evie stands and how to handle Jasmine's feedback. Last updated November 4, 2026.

## Where things are

| Thing | Location |
|---|---|
| Branch | `claude/nice-noether-7rdo8e` (no PR yet) |
| APK | GitHub Actions → newest green **CI** run → artifact `meztli-debug-apk` (kept 14 days) |
| Product decisions | `docs/design/evie/DECISIONS.md` |
| Install + test checklist | `docs/TESTING.md` |
| What to tell Jasmine, questions to ask | `docs/FOR_JASMINE.md` |
| Feedback format | `docs/FEEDBACK_TEMPLATE.md` |
| Terms / Privacy (generated from `app/src/content/legal.ts`) | `docs/legal/` |
| Browser test scripts (Playwright) | `app/e2e/` — see its README |

## State of the build

- **Owner app (Android, her A53):** onboarding (role, terms + privacy consent, name, purpose, last period, method, reminders, lock), Today, Log sheet, Calendar, Insights, You; Why this estimate; birth control with pack day and reminders; life context; pregnancy; doctor summary (PDF); partner sharing; privacy & data (export, restore, delete, transfer ledger); PIN/fingerprint lock; home-screen widget; guide; articles; English + Spanish; Night/Day themes.
- **Partner app (iPhone):** join, read-only Today/Support/Shared/You. Not yet built on a Mac.
- **Relay:** Cloudflare Worker in `workers/relay/`, unit tested, **not deployed** (needs Kelvin's `wrangler login` + deploy, then the `VITE_RELAY_URL` repo variable).
- **Checks at hand-off:** 218 unit tests, typecheck, CI (web + Android build + JUnit) green; Playwright crawls of every reachable screen in both languages with 0 errors and 0 axe violations; end-to-end pairing, restore, lock, method setup, legal gate, guide.
- **Estimate engine:** calibrated by `app/src/engine/calibration.test.ts` to hold the next period in the window ~85% of the time.

## Known gaps (not bugs, just not done)

- iOS build untested; free signing expires every 7 days.
- Relay not deployed, so pairing needs the relay URL typed in until it is.
- Plant and logo are placeholder art.
- Health wording and Spanish need the clinician friend and a native speaker. Jasmine's PA eye is the first pass.
- Articles and the week-by-week pregnancy guide are English only (labelled in Spanish).
- Terms and Privacy Policy were written to match the app but **not reviewed by a lawyer**. Do that before any public release.
- Partner copy says "her" for the owner; decide whether to use the owner's name instead.

## How to handle feedback

1. Kelvin pastes `docs/FEEDBACK_TEMPLATE.md` filled in, plus screenshots.
2. Sort every item into one table. Do not start coding before this table exists and Kelvin has seen it:

   | # | Type | Where | Her words | Severity | Plan |
   |---|---|---|---|---|---|
   | | bug / confusing / missing / annoying / words / loved | screen | quote | P0 data loss or wrong health info · P1 blocks a task · P2 friction · P3 polish | fix / ask / later |

3. P0 first, always: anything that loses data, shows wrong health information, or leaks something private.
4. "Loved" items are constraints: don't change those while fixing other things.
5. Medical-wording items: fix what's clearly wrong; list the rest for the clinician.
6. For each fix: reproduce in the browser first (scripts in `app/e2e/`), fix, add a test, re-run the crawls, push, and confirm CI is green and a new APK exists.
7. Reply to Kelvin with the new CI run number to install, what changed in her words, and what's still open.

## Before touching code next time

```sh
cd app && pnpm install --frozen-lockfile
npx tsc --noEmit -p . && npx vitest run
npx vite --port 5173 &                     # dev server for the e2e scripts
node ../workers/relay/dev-server.mjs &     # local relay for pairing tests (see app/e2e/README.md)
```

Bump `LEGAL_VERSION` in `app/src/content/legal.ts` only if the meaning of the terms changes; everyone is then asked to agree again. Regenerate the docs with `UPDATE_LEGAL=1 npx vitest run src/content/legal.test.ts`.
