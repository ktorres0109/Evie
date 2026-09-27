# Evie v1 plan

Goal: a polished v1 of the owner app on Android (Galaxy A53) and the partner app
on iPhone, in English and Spanish. The budget is about 4–5 weeks of focused work.
Every phase keeps `pnpm test` green and ends with a commit and push.

Acceptance criteria are the §08 QA checklist in the spec, plus the items in
DECISIONS.md.

## Phases

| Wk | Phase | Contents | Risk |
|---|---|---|---|
| 0 | Foundation | Rename Lunara → Evie (app id per O5) · string catalogue + EN/ES i18n · forbidden-word test · tokens + self-hosted font · replace CI with lint/typecheck/test · remove the publik workflow | Low |
| 1 | Core owner UI | Tab bar (edge-to-edge insets) · Today · Log sheet (six flow levels, mood words, energy/sleep hidden via migration) · Calendar | Med |
| 2 | Engine + estimates | **Life-context model** (dated entries for every D1 factor) · relative-outlier exclusions with reasons · 1–5 confidence · Why this estimate · Fertility status | Med |
| 2 | Birth control | New method types · withdrawal-bleed schedule + comfort content · pill/patch/ring reminders · missed-dose logging | Med |
| 3 | Sensitive health | Pregnancy + "Pregnancy ended" flow (C1–C6) · aftercare through the safety banner · postpartum/breastfeeding | Med |
| 3 | Onboarding + You | Six-step onboarding (age gate, O6) · Privacy & data backed by a real transfer ledger · delete-everything · AGPL source link · companion plant (placeholder art) | Med |
| 4 | Partner | Pairing (QR + 6-char code + 4-word phrase) · scope switches · partner shell · transport per O1 | **High** |
| 4 | Ship prep | Android APK on the A53 · iOS build on a Mac (O3/O4) · accessibility pass (TalkBack, VoiceOver, 200% text) · §08 QA run · clinician + Spanish review | Med |

## The one idea that ties it together

Every factor that can change a cycle (birth control, pregnancy and its ending,
postpartum, conditions, illness, travel) is stored as a **dated life-context
entry**. The engine turns entries into one of three effects:

| Effect | Example | What the user sees |
|---|---|---|
| Withhold | Hormonal method, pregnancy, testosterone | "No estimate right now, and why" |
| Widen | EC taken, stopped the pill, PCOS | Wider range, lower confidence |
| Exclude a cycle | Illness or travel tag, far outlier | Row under "What we left out", with the reason |

This lets one mechanism cover every D1 row, and it feeds the "Why this
estimate" screen directly.

## Risks to watch

1. **Partner transport (O1).** Android ↔ iPhone rules out Multipeer (Apple-only) and Wi-Fi Direct (Android-only). Local sync means a custom LAN plugin on both. A QR snapshot needs no network code.
2. **iOS signing.** Without the paid Apple account, the partner app stops opening every 7 days.
3. **Health copy in two languages.** The clinician review has to cover the Spanish text too, not only a translation of approved English.
4. **Art.** The logo and 5 plant stages are placeholders until someone draws them.
