# Handoff: Evie — Night Bloom redesign (owner + partner app)

> **Status: planning (v0.4).** Contradictions from v0.3 are resolved in the table below. Open product choices live in [`DECISIONS.md`](./DECISIONS.md).

## Resolved in v0.4
| Topic | Decision |
|---|---|
| Display tracking | −0.03em everywhere |
| Radius | 8 chip · 12 field · 18 small card · 20 card · 24 sheet · pill (tokens.css wins) |
| Nav icon size | 24px (4px grid; no 27px) |
| Flow options | Six: None, Spotting, Light, Medium, Heavy, Very heavy |
| Haptics | Destructive confirm only |
| Fonts | One family, Plus Jakarta Sans variable |
| Themes | Night Bloom + Day Bloom + "Match system" (two themes) |
| Partner shell | Four destinations |
| `text-3` | `#8E85A6` → `#978EAF` so it passes 4.5:1 on surface-3 (was 4.05:1) |
| Engine exclusions | Current engine only drops cycles outside 15–90 days and returns bare lengths. Needs relative-outlier exclusion + `{cycleEnd, length, reason}` + 1–5 confidence (see `app/src/engine/cycleForecast.ts`). |

## Overview
Evie is a local-first, AGPL-3.0 cycle tracker, forked from Lunara (`ktorres0109/Evie`). This bundle holds the final visual and UX specification for the core cycle-tracking experience, the optional fertility-awareness mode, local partner pairing, and the care companion. It replaces the current light "mineral paper" theme with a dark theme called **Night Bloom**, plus an optional light **Day Bloom**.

**Target devices (updated 2026-09-27):**
- **Owner phone: Samsung Galaxy A53** (6.5″, 1080 × 2400, about 412 × 915 CSS px [LIKELY]). It launched on Android 12 and is eligible for updates up to Android 16 [LIKELY], so assume **Android 15+**. The app targets SDK 36, so **edge-to-edge is enforced**: honour `env(safe-area-inset-*)` and the system-bar insets, whether she uses three-button or gesture navigation. The earlier "Android 11, no inset" note no longer applies.
- **Partner phone: iPhone 16 Pro Max** (440 × 956 pt, home indicator).
- **Performance floor stays at the Galaxy A50 class** (2020 midrange, 3 GB). The A53 is faster, but the app is meant for anyone.
**Audience:** women under 30. The feel should be premium, calm, private and smart. It should never feel cute, clinical or pushy.

## About the design files
`Evie Design Spec v3.dc.html` is a **design reference built in HTML**, not production code. Open it in a browser (it needs `support.js`, `android-frame.jsx` and `ios-frame.jsx` beside it). Recreate these designs in the **existing app stack**, using its patterns. Do not port the HTML.

Verified from the repo on 2026-09-24:
- `app/`: React 18, Vite 6, TypeScript, Capacitor 8 (iOS + Android), Dexie (IndexedDB), Zustand.
- Styling: plain CSS in `app/src/styles/` (`tokens.css`, `app.css` at 176 KB, `base.css`, `brand.css`, `health.css`, …).
- Screens live in `app/src/screens/` (`Today.tsx`, `Onboarding.tsx`, `Insights.tsx`, `Settings.tsx`, …) and `app/src/components/` (`TabBar.tsx`, `CalendarScreen.tsx`, `LogSheet.tsx`, `Sheet.tsx`, `DateStrip.tsx`, `CycleRing.tsx`, `PinLock.tsx`).
- The current `TabBar.tsx` has 4 labelled tabs (`today`, `insights`, `graphs`, `settings`) with inline SVG icons.

## Fidelity
**High fidelity** for the ten screens in §05 and all tokens in §02: final colours, type, spacing, radii and copy. Build them pixel-close.
The **adjacent** surfaces listed in §03 (TTC, pregnancy, perimenopause, assistant, reminders, doctor report, backup) are **not** designed. Restyle them with the tokens only and leave their layouts as they are.

## Recommended plan (in order)
Each phase is shippable on its own. Keep `pnpm test` green after each one.

1. **Tokens + font (low risk, highest visible impact).**
   - Replace `app/src/styles/tokens.css` with `tokens.css` from this bundle. It keeps the old variable names as aliases so existing views still compile.
   - Self-host Plus Jakarta Sans (SIL OFL [LIKELY], variable woff2) in `app/public/fonts/`. **Do not use Google Fonts in production.** A CDN font means a network request, which breaks the offline and privacy promise.
   - Then grep `app.css` for hard-coded hex values and `rgba(` colours, and move them onto tokens. The aliases are a **[GUESS]** mapping from light to dark. Any place that used `--paper-*` as a background with `--ink-*` text should invert correctly, but check contrast screen by screen.
2. **Tab bar** (`TabBar.tsx`). Spec below. This changes the tab set, so update the `Tab` union and any routing in `App.tsx`.
3. **Today** (`Today.tsx`). Hero, prediction card, quick-log row, conditional fertility card, one insight, companion.
4. **Log sheet** (`LogSheet.tsx`). Flow, symptoms, mood, intimacy row, BBT/OPK, notes. **Remove energy and sleep** (a product decision; see below).
5. **Calendar** (`CalendarScreen.tsx`). Solid means logged, dashed means predicted, and the legend is always visible.
6. **Why this estimate** (new screen, reached from every estimate) and **Fertility status** (new).
7. **Onboarding** (`Onboarding.tsx`, 62 KB). Cut it to 6 steps, each with one title, one choice and one button.
8. **Privacy & data** (`Settings.tsx`) and the **Companion** plant with its return-after-absence state.
9. **Partner pairing + partner shell.** This is the largest new piece. `docs/upstream-lunara/LOCAL_CAPABILITY_BOUNDARY.md` currently says partner sharing is out of scope. Update that doc first (see "Partner architecture").

## Global rules (non-negotiable)
- **Colour is never alone.** Every health state carries colour, a label, and a pattern or glyph. Logged = solid, predicted = dashed. This rule holds everywhere.
- **Forbidden fertility vocabulary:** safe, protected, green light, clear, free, infertile, can't get pregnant. Add a unit test that scans the string catalogue for these words.
- **Never a single predicted date.** Always a range, with confidence shown as a 5-segment meter plus a word.
- **Berry `#C2496F` is marker-only.** Any berry fill that carries text uses `--berry-deep #A33755` with `--text` on top (5.7:1). Dark text on berry fails at every shade.
- **No streaks, no missed-day counts, no guilt copy, no locked health content.**
- **Animate `transform` and `opacity` only.** Nothing animates longer than 240 ms. Under reduced motion, every transition becomes an opacity fade of 80 ms or less.

## Tab bar (owner)
- **Slots:** Today · Calendar · **Log (centre)** · Insights · You. Icons only, no labels.
- **Icons:** Phosphor. Use `@phosphor-icons/react` with per-icon imports (a new dependency [LIKELY] package name; confirm on npm). Alternatively, paste the SVG paths into the existing inline-SVG pattern. That keeps zero new dependencies and matches the current `TabBar.tsx`, so it is the recommended option.
  - Today `House`, Calendar `CalendarBlank`, Insights `ChartLine`, You `User`, Log `Plus` (bold).
- **Unselected:** regular weight, 24px, `#978EAF`. **Selected:** fill weight, 24px, `#C4B2FA`. There is no pill and no underline. The selected state is the change from outline to filled.
- **Hit area:** each slot is 52 × 48.
- **Log button:** 62px circle, `--primary`, 4px ring in `--surface-1`, raised 28px above the bar, shadow `--shadow-log`, plus icon 28px `--on-primary`. Tapping it opens `LogSheet` for today.
- **Separation:** a 32px `--nav-fade` above a `--surface-1` bar. **No border-top.**
- **Bar:** `position: sticky; bottom: 0`, padding `0 12px 10px`, plus `--safe-bottom` on iOS (30pt effective above the home indicator).
- **Galaxy A53 (Android 15+, targetSdk 36):** the app is drawn edge-to-edge, behind the system bar. Pad the bar by `--safe-bottom` on Android as well as iOS, and draw `--surface-1` under the navigation area so the system buttons (or gesture pill) and the tab bar read as one band. Test both three-button and gesture navigation.
  - Older Android (≤14, the A50 class) may report a 0 inset. The same CSS handles both.
- **Accessibility:** `aria-label` on every button and `aria-current="page"` on the selected one. TalkBack should read "Calendar, tab 2 of 5, selected".
- **Behaviour:** keep the existing "tap the active tab to scroll to top" logic.
- **Partner shell:** four slots (Today `House`, Support `HandHeart`, Shared `Eye`, You `User`) and no Log button.

## Screens (see the HTML §05 for exact layout and copy)
| # | Screen | Maps to | Key specs |
|---|---|---|---|
| 5.1 | Onboarding: purpose | `Onboarding.tsx` | 2×2 tiles (radius 20, min-height 118). Title "What brings you here?", helper "Pick any." Lock line "Stays on this phone". |
| 5.2 | Owner Today | `Today.tsx` | Hero "Day 14", 52px/600/−0.03em, with the `--hero-glow` behind it. Range card uses the confidence meter. Quick-log row: Flow, Mood, Pain, Discharge, More. |
| 5.3 | Quick log | `LogSheet.tsx` | Flow as 6 discrete radios (None, Spotting, Light, Medium, Heavy, Very heavy), never a slider. Symptoms as chips with ✓. Mood as 6 words (Calm, Happy, Low, Irritable, Anxious, Sensitive). Persistent "Saved on this device · offline" strip. |
| 5.4 | Calendar | `CalendarScreen.tsx` | 46px cells with a 4px gap. Logged = solid `--berry-deep`, predicted = 1.5px dashed `--berry-hi`, today = 2px `--primary` ring. Permanent legend. |
| 5.5 | Why this estimate | new | Range restated. "What we used" list. "What we left out" with a reason. One-sentence method: median plus spread. |
| 5.6 | Fertility status | new | Three-state chip. The not-contraception block sits second on screen, at body size. Inputs labelled with their limits. |
| 5.7 | Partner pairing | new | QR plus 6-character code, 3-minute expiry, single use. Four-word verification phrase confirmed on the owner's device. Four scope switches (Symptoms off by default). A "Never shared" list. |
| 5.8 | Partner Today | new shell | A phrase, not metrics. A softened range. Support lines written by the owner, verbatim. A staleness footer. |
| 5.9 | Companion return | new | The plant never shrinks or wilts. Buttons: "Log today" / "Add days I missed" / "Just looking". |
| 5.10 | Privacy & data | `Settings.tsx` | Status card driven by a real transfer ledger. Pause sharing. Export. Delete, which requires typing to confirm and has Cancel focused by default. |

## Interactions & motion
- **Press:** `scale(0.97)` over 120 ms `--ease`, released on the same curve.
- **Chip/toggle:** 120 ms. **Screen push:** translateX 24px plus fade, 180 ms. **Sheet:** translateY, 240 ms, no blur on the scrim.
- **Calendar months:** swap them, don't use a carousel. Mount only one month at a time.
- **Plant growth:** a 240 ms cross-fade between static stage assets, only when a threshold is crossed.
- **Haptics:** `@capacitor/haptics` is already installed. Medium impact on destructive confirm only. Nothing else (matches §06).
- **Performance budgets** (on the A50-class floor device): cold start under 1800 ms, tab switch under 120 ms, log write under 100 ms, memory under 180 MB. No `backdrop-filter` anywhere.

## State / data
- **Estimates:** reuse the existing `app/src/engine/` (24 files) and don't rewrite it. The new UI needs the engine to expose, per estimate: the included cycles, the **excluded cycles with a reason**, the median, the spread, and a confidence level from 1 to 5. If the engine doesn't return exclusions yet, that is the one engine change required.
- **Dexie:** remove energy and sleep from the log schema. Migrate old records by keeping the data but hiding the fields. Mood becomes a multi-select of 6 words.
- **Companion:** stage = f(lifetime check-ins) at thresholds 5 / 15 / 35 / 70 / 120. It is monotonic. "Resting" is a pure UI state after a gap of 7 days or more.
- **Zustand:** needs `theme`, `fertilityMode`, `partner.{status, scopes, paused, lastSync}`, and `notificationTone`.

## Partner architecture
[GUESS, needs a spike] Pairing is same-room only: the owner shows a QR code, the partner scans it, and the two confirm a phrase. After that, the partner's copy refreshes over the local network. Capacitor has no first-party peer-to-peer plugin [LIKELY]. Options: a local HTTP server on the owner's phone via a community plugin, or Wi-Fi Direct / Multipeer through a native bridge. Spike this before building the UI. If it proves unworkable, fall back to "owner re-shares a signed snapshot by QR", which still needs no server. The UI copy already states that revocation is best-effort.

## Design tokens
All tokens are in `tokens.css` (dark `:root`, light `[data-theme='day']`, and reduced-motion overrides). Summary:
- **Colours:** bg `#14111C`, surfaces `#1C1826` / `#241F31` / `#2E2840`, text `#F3EFF7` / `#A9A0BC` / `#978EAF`, primary `#8B6BE8`, berry `#C2496F` (marker) / `#A33755` (text fills).
- **Spacing:** 4-based (4 … 56). **Radius:** 8 / 12 / 18 / 20 / 24 / pill.
- **Type:** Plus Jakarta Sans only. Display 600 at −0.03em, body 400–500.
- **Cards are borderless:** a surface fill plus a 1px inner top highlight. No hairline borders on cards.

## Why these choices (short)
- **Dark, low-chroma, one glow:** this reads as premium and private. It is calm rather than bubbly [LIKELY, based on general emotional-design practice; the bundled emotion reference files weren't available in this session].
- **One typeface:** a cohesive, "smart" feel with fewer bytes. Plus Jakarta Sans replaced the rounded Fredoka the user rejected as not premium.
- **Icon-only nav with a raised Log button:** logging is the core loop, so it gets the only filled control. The filled-versus-outline change keeps the selected tab obvious without labels.
- **Energy and sleep removed:** they add taps and don't improve any estimate. This was the user's call, and the spec agrees.

## Assets
- **Icons:** Phosphor, MIT licence [LIKELY].
- **Plant stages:** placeholders built from CSS shapes in the HTML. **An illustrator needs to produce 5 flat SVG stages** plus a desaturated "resting" treatment.
- **The QR code in the HTML is fake.** Use a real QR library at build time.
- **Brand mark:** the gradient dot in the HTML is a placeholder. The repo still ships `app/brand/lunara-*.svg`, which needs an Evie mark.
- **No user-facing string may say "Lunara".** Grep for it in `app/src` and in `capacitor.config.ts`, then rename `package.json` names, the app id and the display name.

## Open questions for the owner
1. Should Day Bloom ship in v1, or only Night Bloom?
2. For partner transport, which fallback is acceptable if local peer-to-peer fails (QR snapshot)?
3. Who draws the plant stages and the Evie mark?

## Files in this bundle
- `Evie Design Spec v3.dc.html`: the full spec. §01 thesis · §02 tokens · §03 screen map · §04 components · §05 screens (5.0 shows both devices) · §06 motion/performance · §07 reference study · §08 QA checklist, which serves as the acceptance criteria.
- `support.js`, `android-frame.jsx`, `ios-frame.jsx`: needed only to view the HTML. `android-frame.jsx` was locally extended with a `samsung` prop (waterdrop notch plus three-button nav).
- `tokens.css`: drop-in token sheet for `app/src/styles/`.
