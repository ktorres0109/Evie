# Meztli: install and test

Three parts, in this order: deploy the relay, put the app on Jasmine's phone, put the partner app on your iPhone.

## 1. Deploy the relay (once, ~5 min, on your Mac)

The relay is needed only for partner sharing. Her app works fully without it.

```sh
cd workers/relay
pnpm install
npx wrangler login     # your existing Cloudflare account
pnpm deploy            # prints https://meztli-relay.<you>.workers.dev
curl https://meztli-relay.<you>.workers.dev/v1/health   # → {"ok":true}
```

Then on GitHub: repo **Settings → Secrets and variables → Actions → Variables → New variable**
`VITE_RELAY_URL` = that URL. From then on, every APK that CI builds has it built in.
(Skip this and the app asks for the relay URL while pairing instead.)

## 2. Android: Jasmine's Galaxy A53

1. GitHub → **Actions** → latest green **CI** run on this branch → **Artifacts** → download `meztli-debug-apk` (a zip).
2. Unzip it. Send `app-debug.apk` to her phone (Google Drive, Quick Share, or USB).
3. On her phone, open the file. Samsung asks to allow installs from that app (My Files / Drive): allow it.
4. Play Protect may warn "unknown app". Tap **More details → Install anyway**. This is because it's a debug build you made, not a Play Store app.
5. Updating later: install the newer APK over the old one. Her data stays. **Don't uninstall first**, because uninstalling deletes all her data.

## 3. iPhone: your partner app (free Apple ID)

```sh
cd app
echo "VITE_RELAY_URL=https://meztli-relay.<you>.workers.dev" > .env
pnpm install
pnpm native:ios        # builds, syncs, opens Xcode
```

In Xcode:
1. Select the **App** target → **Signing & Capabilities** → Team = your Personal Team. If the bundle ID is taken, change it to something unique, like `io.github.ktorres0109.cycle.kelvin`.
2. If the **MeztliWidgetExtension** target fails to sign, set its team too. Or remove it from App → General → Frameworks, Libraries and Embedded Content, since the partner side doesn't need the widget.
3. Plug in the iPhone, pick it as the run destination, press **Run**.
4. iPhone: **Settings → General → VPN & Device Management** → trust your developer certificate. Turn on **Developer Mode** if iOS asks.
5. Free signing expires after **7 days**. Press Run again in Xcode and it reinstalls, with your data kept.

## 4. Pair (together, same room)

1. Her phone: **You → Partner sharing → Invite your partner**. Pick what to share → **Show pairing code**.
2. Your phone: open Meztli → **I'm a partner** → scan the QR with the iPhone Camera, or type the 6-character code.
3. Both screens show **4 words**. Only if they match exactly, she taps **They match**.
4. Your app now shows a read-only view. Her phone uploads a few seconds after she logs; yours fetches when you open the app or tap Refresh (and every 15 minutes while it's open).

She can **pause** or **stop sharing** at any time from the same screen. Stopping wipes the relay copy.

## 5. What to try and report back

| Area | Try this |
|---|---|
| First run | Onboarding in Spanish and English (language switch is on the You tab) |
| Daily use | Log flow, mood, symptoms for a few days; use the + button and the quick chips |
| Estimate | Does "Why this estimate?" make sense to her? Is the range believable? |
| Birth control | Set her real method; check reminders fire at the right time |
| Calendar | Tap past days, edit a logged period, check the legend |
| Privacy | Set a PIN; check the app is hidden in the recent-apps screen |
| Partner | Do you see only what she chose? Pause, then resume |
| Look | Night Bloom vs Day Bloom; anything cut off, overlapping, too small |

For each problem: **what she tapped, what she expected, what happened**, plus a screenshot.

## Known gaps in this build

- iOS has not been built on a Mac yet (no Xcode in the cloud). Expect possible signing tweaks.
- The plant and logo are placeholder art.
- Health content and Spanish copy still need the clinician and native-speaker review.
- The estimate needs about 3 logged periods before it's confident. Because she's starting fresh, the first months will show wide ranges. That's on purpose.
