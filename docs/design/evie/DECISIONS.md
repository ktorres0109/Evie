# Evie — open product decisions

Status: planning. Round 1 answers recorded 2026-09-27 (see **Decided** and
**Still open** at the bottom). Each item lists options and a recommendation (**Rec**).
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

## Still open (round 2)

| # | Question | Why it matters |
|---|---|---|
| O2 | AI: none, on-device only, or bring-your-own-key? | It's the only feature that could send health data off the phone |
| O5 | Permanent app ID (e.g. `com.<you>.evie`) | Store IDs can never change after release. The display name can |
| O6 | Final age rule | Tentatively matches Flo (below) |
| O7 | Partner updates: encrypted relay (automatic) or share-sheet file (manual, no server)? | They don't live together, so same-Wi-Fi sync is out |

## Decided

| Date | Item | Decision |
|---|---|---|
| 2026-09-27 | Design contradictions (v0.3) | See "Resolved in v0.4" in README.md |
| 2026-09-27 | A1 audience | Two-person product: an owner and her partner. Built at public-release quality so any woman can use it and make it hers |
| 2026-09-27 | A2 platforms | Both at once. Owner app on Android (Galaxy A53), partner app on iPhone (16 Pro Max). One codebase, both roles available on both platforms |
| 2026-09-27 | A3 age (tentative) | Follow Flo's published rule: 13+ generally, 16+ in the EU, UK and Canada. Some features are limited under 18 (which ones is TBD) |
| 2026-09-27 | Legal baseline | Store no data on any server, so there is nothing to share, sell or subpoena from us. Flo is the cautionary tale here (2021 FTC settlement; 2025 jury verdict against Meta over Flo data). Still needed before a public release: a truthful privacy policy, the Play Data safety form, Apple privacy labels, and a check against California CMIA and Washington MHMDA if any data ever leaves the phone |
| 2026-09-27 | A4 adjacent modes | Default: keep pregnancy + doctor report. Hide TTC, perimenopause and backup in v1. AI depends on O2 |
| 2026-09-27 | B1 methods | All of them, including the new types (progestin-only pill, copper vs hormonal IUD, barrier, emergency contraception) |
| 2026-09-27 | B2 predictions | Expected withdrawal bleed shown for pill/patch/ring, plus comfort content for those days. Emergency contraception and stopping a method as in B2 |
| 2026-09-27 | B3 reminders | Pill + patch/ring changes. Neutral lock-screen text |
| 2026-09-27 | B4 missed dose | Default: log it and point to the leaflet or a pharmacist. No built-in rules |
| 2026-09-27 | C1–C6 pregnancy endings | Defaults: neutral "Pregnancy ended" entry; date only unless the user opts into detail; never shared with a partner; opt-in per export; "delete this record only"; aftercare warning signs + a sourced resource list; breastfeeding toggle |
| 2026-09-27 | D1 life context | All rows in v1 |
| 2026-09-27 | D2 conditions | Self-report only. The app never suggests a condition |
| 2026-09-27 | E3 languages | English + Spanish in v1. Health copy is reviewed in both languages |
| 2026-09-27 | E4 name/logo | Can change later |
| 2026-09-27 | E5 content review | A clinician friend reviews all health copy. Every claim cites a source |
| 2026-09-28 | O1 living situation | Not living together. Local-network sync dropped. Choice narrowed to O7 |
| 2026-09-28 | O3 Mac | Has a Mac, used to build the iPhone app. No Mac app in v1 |
| 2026-09-28 | O4 Apple account | Free Personal Team only. Consequences: the iPhone build must be re-signed from Xcode every 7 days (or kept alive with a sideload refresher [LIKELY: SideStore/AltStore]); no push notifications, App Groups, associated domains or iOS widgets [per Apple/Expo docs], and HealthKit is likely unavailable too; no App Store or TestFlight. The iPhone app needs a free-team build config that strips those entitlements. That's fine for the partner role, which needs none of them. Public release for other women happens on Android first (GitHub releases / F-Droid for free, or Play for a one-time $25) |
| 2026-09-27 | Timeline | Take the time: a polished v1, even if it takes about a month |

### Sources for the legal baseline
- Flo minimum age: <https://help.flo.health/hc/en-us/articles/360042626231-Can-I-use-Flo-below-the-age-of-13>, <https://flo.health/terms-of-service>
- FTC 2021 settlement and state laws: <https://pmc.ncbi.nlm.nih.gov/articles/PMC11923453/>, <https://jgspl.org/greater-privacy-protections-are-needed-for-womens-health-data-on-period-tracking-apps/>
- 2025 Meta verdict and $59.5M settlement: <https://www.hipaajournal.com/jury-trial-meta-flo-health-consumer-privacy/>, <https://www.rivkinrounds.com/2025/08/flo-health-data-sharing-case-ends-in-major-jury-verdict-against-meta/>

Not legal advice. Get a lawyer's read before a public store release.
