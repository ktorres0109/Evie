# Evie — open product decisions

Status: planning. Each item lists options and a recommendation (**Rec**).
Answer by number (e.g. `B2: b`). Once answered, move the item to "Decided"
at the bottom with the date.

Medical facts here are for planning only. Anything that ships as user-facing
health content needs a cited source and review before release.

---

## A. Scope and audience

**A1. Who is v1 for?**
- a) One person (installed from source on one phone)
- b) Small group (TestFlight / Play internal testing)
- c) Public store release

Rec: **a first, built as if it were c.** Store release adds privacy policy,
age rating, medical-claim review and support burden. Don't design yourself into
a corner, but don't block v1 on it.

**A2. Which phone ships first?**
- a) Android (Galaxy A50 is the reference device)
- b) iPhone (needs a Mac + Xcode)
- c) Both at once

Rec: **ship first on whichever phone the main user owns.** Keep the other building in CI.

**A3. Minimum age**
- a) Keep the current 13+
- b) 16+
- c) 18+

Rec: **a, with sensitive sections (pregnancy endings, sexual activity) opt-in.**
Teens need cycle tracking most, but store review and parental-consent laws get
stricter if you collect health data from minors. Revisit before A1 = c.

**A4. Keep the adjacent modes that already exist in code?**
TTC · pregnancy · perimenopause · AI assistant · encrypted backup · doctor report
- For each: keep / hide in v1 / delete

Rec: **keep pregnancy + doctor report; hide TTC, perimenopause, assistant,
backup in v1.** Fewer surfaces = fewer places sensitive data can leak.

---

## B. Birth control

The repo already has a dated regimen model (`app/src/db/regimen.ts`) for pill,
patch, ring, injection, implant, IUD. It lacks the items marked *new*.

**B1. Which methods can be recorded?** (multi-select)
- Combined pill · progestin-only pill (*new*: different rules, no placebo week)
- Patch · ring · injection · implant
- Hormonal IUD · copper IUD (*new*: split; copper is non-hormonal)
- Condom / barrier (*new*, as a per-day log, not a regimen)
- Emergency contraception (*new*, one-off event)
- Withdrawal · fertility awareness · partner vasectomy · none

Rec: **all of them.** Recording costs little; the engine behaviour (B2) is what matters.

**B2. How does birth control change predictions?**
- Hormonal methods: withhold ovulation/fertile estimates (already in the spec).
  For pill/patch/ring, what about bleeding?
  - a) Show expected withdrawal bleed from the pack schedule
  - b) Show nothing
  Rec: **a**, labelled "withdrawal bleed", never "period".
- Copper IUD / barrier / none: predictions run normally.
- Emergency contraception: can shift the next period. Rec: **widen the next
  range and add an exclusion reason ("EC taken on …")**.
- Stopping a hormonal method: the first cycles after can be irregular. Rec:
  **mark the first 3 cycles after stopping as "settling" and widen the range.**

**B3. Reminders**
- a) Daily pill reminder only
- b) Pill + patch/ring change + injection/implant/IUD renewal dates
- c) None in v1

Rec: **b.** The reminder engine already exists. Lock-screen text stays neutral
("Evie reminder"), per the notification rules.

**B4. Missed-dose help**
- a) Log it only, and say "Check your leaflet or ask a pharmacist"
- b) Built-in missed-pill rules per pill type

Rec: **a for v1.** The rules differ by pill brand and type, and getting them wrong
is a real pregnancy risk. Never say "you're protected" (it's forbidden vocabulary).

---

## C. Pregnancy and pregnancy endings (including abortion)

**C1. How is a pregnancy ending recorded?**
- a) One neutral entry: "Pregnancy ended", with an optional private detail
  (birth · miscarriage · abortion · ectopic · other · prefer not to say)
- b) Separate named buttons for each outcome
- c) Don't record outcomes, only "not pregnant anymore"

Rec: **a.** It's respectful, it doesn't force anyone to name it, and the engine
only needs the date.

**C2. Store less by default?**
- a) Store date + outcome
- b) Store date only unless the user opts into detail
- c) Let the user choose at entry time ("Don't keep details")

Rec: **c, defaulting to date only.** Data that doesn't exist can't be seized or
leaked. That matters in places where abortion is legally restricted.

**C3. Who can ever see it?**
- Partner: never (add it to the "Never shared" list)
- Export / doctor report: a) always included · b) opt-in per export · c) never

Rec: **b**, off by default, with its own checkbox.

**C4. Extra protection for sensitive records**
- a) Nothing beyond app lock
- b) A separate lock for the pregnancy-history section
- c) "Delete this record only" that also removes it from derived stats

Rec: **c, plus b later.** State the honest limits (a lock doesn't stop a court or
someone forcing you to unlock), the same way §5.10 already does.

**C5. Aftercare and resources**
- Warning signs after miscarriage/abortion (heavy bleeding, fever, severe
  pain) routed through the existing safety banner: **Rec: yes**, sourced from
  clinical guidance.
- Care or hotline links:
  - a) None
  - b) A small, sourced list with a "last checked" date
  - c) Let the user add their own

  Rec: **b + c.** No legal advice in-app, because laws change and vary by place.

**C6. After a pregnancy ends**
- Postpartum and breastfeeding modes: predictions withheld or very wide, as the spec already says
  for 6 months postpartum. Rec: **add "breastfeeding" as a toggle that extends
  the withheld window.**
- After miscarriage/abortion: rec **resume predictions at the next logged period,
  with the first cycle marked "settling".**

---

## D. Other things that affect the cycle

Rec for all of D: model them as **dated "life context" entries** (start date,
optional end date). The engine uses them to widen a range or exclude a cycle, and
every exclusion shows up in "Why this estimate → What we left out" with the
reason. This connects directly to the engine change already needed.

**D1. Which to support in v1?** (multi-select)
| Factor | Effect on estimate |
|---|---|
| Pregnancy / postpartum / breastfeeding | Withhold |
| Hormonal birth control | Withhold fertility estimates; show withdrawal bleed |
| Emergency contraception | Widen next range |
| Stopping birth control | Mark next cycles as "settling" |
| Pregnancy loss / abortion | Resume at next period, first cycle "settling" |
| PCOS · endometriosis · thyroid condition | Widen range; note in doctor report |
| Perimenopause · menopause | Widen range / withhold after 12 months with no period |
| Illness · big stress · travel across time zones | Optional tag that can exclude that cycle |
| Big weight change · intense training | Optional tag |
| Gender-affirming testosterone | Withhold (periods often stop) |
| Hysterectomy · endometrial ablation | Withhold bleeding predictions |
| Other medication (free text) | Note only |

Rec: **first 5 rows plus the illness/stress/travel tag in v1**, the rest in v2.

**D2. Wording for conditions**
- a) User self-reports ("I've been told I have PCOS")
- b) The app suggests conditions from patterns

Rec: **a only.** Suggesting a condition is diagnosing, and the spec bans that.

---

## E. Sharing, data, and release

**E1. Partner feature in v1?**
- a) QR snapshot (partner re-scans to refresh; no network code)
- b) Live local-network sync (needs a native spike)
- c) Later

Rec: **a**, since it's the main reason the app exists (helping one person and
the person they choose).

**E2. AI assistant**
- a) Hide in v1
- b) Keep (bring your own API key)

Rec: **a.** It's the only feature that sends health text off the phone.

**E3. Languages**
- a) English only
- b) English + Spanish

Rec: **a**, but keep all strings in one catalogue so b is cheap. The catalogue
is also needed for the forbidden-word test.

**E4. Name and logo**
- Check that "Evie" is clear to use in app stores before a public release.
- Who draws the logo and the 5 plant stages?

**E5. Content review**
- Who checks health copy before release? (a clinician friend, a sourced-only rule, or both)

Rec: **every health claim links to a source** (ACOG, NHS, WHO or similar), with
a review date.

---

## Decided

| Date | Item | Decision |
|---|---|---|
| 2026-09-27 | Design contradictions (v0.3) | See "Resolved in v0.4" in README.md |
