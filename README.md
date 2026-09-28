# Meztli

> **Work in progress.** Meztli is not on any app store yet. You build it from
> this repository and install it on your own phone. Don't rely on it as your
> only record of your health data.

**A private cycle companion for one person, and the one they choose.**

*Meztli* (Nahuatl: moon, month) is a local-first cycle, birth-control and
pregnancy tracker with an optional read-only partner app. Everything
meaningful works offline. There is no account and no analytics. The only thing
that ever leaves the phone is the partner update, if you turn it on, and that
is end-to-end encrypted: the relay stores data it cannot read.

Meztli is not a medical device and is not contraception. Estimates are shown as
ranges with their method visible ("Why this estimate?"), never as a single
confident date.

## Status

| Area | State |
|---|---|
| Product decisions | [`docs/design/evie/DECISIONS.md`](docs/design/evie/DECISIONS.md) |
| Design spec (working name "Evie") | [`docs/design/evie/`](docs/design/evie/) |
| v1 plan | [`docs/design/evie/V1_PLAN.md`](docs/design/evie/V1_PLAN.md) |
| Research | [`docs/design/evie/RESEARCH_2026-09-28.md`](docs/design/evie/RESEARCH_2026-09-28.md) |

## Build it

You need [Git](https://git-scm.com/downloads), [Node.js LTS](https://nodejs.org/en/download)
and pnpm (`npm install -g pnpm`).

```sh
git clone https://github.com/ktorres0109/Evie.git meztli
cd meztli
pnpm install
pnpm --filter @meztli/app native:sync   # typecheck, build, copy into iOS/Android
```

Re-run `native:sync` after every code change. The native shells load a copied
bundle, not your live source.

### Android (Mac, Windows or Linux)

1. Install [Android Studio](https://developer.android.com/studio) and let it
   install the default SDK.
2. On the phone: **Settings → About phone → Software information**, tap
   **Build number** seven times, then turn on **Developer options → USB debugging**.
3. `pnpm --filter @meztli/app native:android`, pick the phone, press **▶ Run**.

### iPhone (needs a Mac with Xcode)

1. `pnpm --filter @meztli/app native:ios`
2. In Xcode, select the **App** target → **Signing & Capabilities** and pick
   your Apple ID's **Personal Team** (free). Do the same for the
   **MeztliWidgetExtension** target.
3. If the bundle ID is taken, append something unique, e.g.
   `io.github.ktorres0109.cycle.yourname`.
4. Plug in the iPhone, select it, press **▶ Run**. The first launch fails with
   "Untrusted Developer". Go to **Settings → General → VPN & Device Management**,
   trust your Apple ID, and open the app again.

With a free Apple ID the app stops opening after **7 days**; press **▶ Run**
again to renew it. The free build has no Apple Health, widgets data sharing or
push notifications. The partner role doesn't need any of them.

### Develop

```sh
pnpm dev    # run in a browser
pnpm test   # unit tests (keep the estimate audit at zero violations)
```

## Structure

- `app/`: React + TypeScript + Vite product layer, Capacitor iOS and Android shells
- `workers/backup/`: zero-knowledge encrypted blob relay (Cloudflare Worker), the basis for partner sync
- `docs/design/evie/`: current design, decisions and research
- `docs/upstream-lunara/`: historical docs from the upstream project

## Credits

Meztli is a fork of [Lunara](https://github.com/Blueturboguy07/lunara) by
Blueturboguy07 and contributors, used under the AGPL-3.0.

## License

AGPL-3.0. See [LICENSE](LICENSE). If you run a modified version for other
people, you must offer them its source.
