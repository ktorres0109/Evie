# Giving Meztli to Jasmine

A guide for you (Kelvin): how to install it, what to tell her, when to check in, and what to ask.

---

## 1. Get the app onto her phone (10 minutes)

1. Open **github.com/ktorres0109/Evie** → **Actions** tab → the newest green run of **CI** on branch `claude/nice-noether-7rdo8e`.
2. Scroll to **Artifacts** → download **`meztli-debug-apk`**. It's a zip, so unzip it; inside is **`app-debug.apk`**.
3. Send `app-debug.apk` to her phone: Google Drive, Quick Share, or a USB cable.
4. On her phone, tap the file → allow installs from that app when Samsung asks → **Install**.
   - If Play Protect warns "unknown app": **More details → Install anyway**. It's warning because the app isn't from the Play Store, not because something is wrong.
5. Open **Meztli**, choose **Mine**, and let her go through setup herself. Don't do it for her: her first impression is part of the test.

**Updating later:** send her the newer APK and install it over the old one. Her data stays.
**Never uninstall it.** Uninstalling deletes everything she logged. Before each update, have her do **You → Privacy & data → Export everything** (with a passphrase) as a safety net.
Phone backups (Google, Samsung Cloud) deliberately do **not** include Meztli, for privacy. If she ever switches phones, her own export is the only way to bring her history: export on the old phone, then **Restore from a file** on the new one.

Partner sharing with your iPhone needs the relay deployed and the iPhone app built on your Mac (see `docs/TESTING.md`). It's optional: she can use the app fully without it. Pair later if she wants to.

---

## 2. What to tell her (2 minutes, before she opens it)

Keep it short and honest. Something like:

> "I built you a period tracker. It's called Meztli, which is Nahuatl for moon. It's in Spanish and English.
> Everything you log stays on your phone. I can't see any of it. If you ever want, you can share a little with me, and you choose exactly what. You can stop anytime.
> It's a test version, so it'll have rough edges. I want your honest opinion, especially what's confusing or annoying. Screenshots help a lot.
> Two rules: don't uninstall it (that deletes your data), and don't use it as birth control. It gives estimates, not guarantees."

In Spanish, if she prefers:

> "Te hice una app para tu periodo. Se llama Meztli, que en náhuatl significa luna. Está en español e inglés.
> Todo lo que registres se queda en tu teléfono; yo no puedo ver nada. Si algún día quieres, puedes compartir un poco conmigo, y tú eliges exactamente qué. Lo puedes quitar cuando quieras.
> Es una versión de prueba, así que va a tener detalles. Quiero tu opinión honesta, sobre todo lo que sea confuso o molesto. Las capturas de pantalla ayudan mucho.
> Dos reglas: no la desinstales (se borran tus datos) y no la uses como anticonceptivo. Da estimaciones, no garantías."

Things worth pointing out **after** she's done the setup, not before:
- **It starts fresh**, so the period estimate needs about **two full cycles** before it shows dates. If she remembers when her last few periods started, she can tap those days in the **Calendar** and log them. That gets her a range sooner.
- If anything unusual has affected her cycle, she can add it privately under **You → Things that affect your cycle**. The estimate then leaves that cycle out instead of being thrown off. Only she sees it, and it is never shared. (Don't ask what it is. It's hers.)
- **You → How Meztli works** is a two-minute guide with a "Show me" button for every part.
- As a future PA, she's a better judge of the medical wording than either of us. Ask her to flag anything that sounds wrong, preachy, or alarming.

---

## 3. When to check in

| When | What you're learning | Ask the "Day 1" / "Week 1" / "After her period" questions below |
|---|---|---|
| **Day 1** (right after setup) | Was setup clear? Did anything break? First impression | Day 1 |
| **Day 3–4** | Is logging quick enough that she'd keep doing it? Reminders at the right time? | Week 1 |
| **End of week 2** | Is it becoming a habit or a chore? What does she skip? | Week 1 |
| **The day after her next period starts** | Was logging the period easy? Did the estimate (if any) feel right? | After her period |
| **~6–8 weeks** (after 2 cycles) | The estimate is now real: is the range believable and useful? | After her period + the PA questions |

Don't quiz her every day. Three or four short check-ins beat one long interview. Write down her words, not your summary.

---

## 4. Questions to ask her

Open questions first. Don't defend the app; just listen and write it down.

### Day 1
1. What was your first impression, in one sentence?
2. Was any step of the setup confusing, or did you hesitate anywhere? Which one?
3. Did you read the Terms or the Privacy Policy? Did anything there worry you or feel off?
4. Was anything unclear about what stays private and what could be shared?
5. Spanish or English: which did you use, and did any wording sound unnatural?

### Week 1
6. How long does logging a normal day take you? Too long, fine, or could be faster?
7. What do you log most? What did you look for and couldn't find?
8. Is there anything you'd *never* log? Why not?
9. Did the reminders come at a good time? Too many, too few, annoying?
10. What's the one thing you open the app for?
11. Did anything look broken: cut-off text, overlapping, wrong colors, frozen screens?
12. Light (Day Bloom) or dark (Night Bloom)? Is the text big enough?

### After her period starts
13. Was logging the start of your period easy?
14. Did the app say anything that felt wrong about your body or cycle?
15. Do you understand what "Why this estimate?" is telling you? Do you trust it?
16. Is a range of days (instead of one date) more useful, less useful, or just different?
17. Did the birth control screen (if she uses one) get your method right? Pack day, reminders?

### As a future PA
18. Is any of the health wording inaccurate, outdated, or likely to scare someone?
19. Would the **Doctor summary** be useful to bring to an appointment? What's missing, and what's unnecessary?
20. Are the symptom and discharge options the right ones? Anything a clinician would want that isn't there?
21. Would you recommend this to a friend or a patient? What would stop you?

### Partner sharing (only if you pair)
22. Did pairing feel safe? Was the 4-word check clear?
23. Is what you chose to share with me the right amount? Did anything you didn't expect show up?
24. Would you want to share more, less, or something different?

### Wrap-up (any time)
25. On a scale of 1–10, how likely are you to keep using it? What would make it a 10?
26. If you could change one thing tomorrow, what would it be?

---

## 5. Bring it back to me

Paste her answers and any bugs into the next session using `docs/FEEDBACK_TEMPLATE.md`. Screenshots are gold: send them along. I'll turn it into a prioritized fix list and get to work (see `docs/NEXT_SESSION.md`).
