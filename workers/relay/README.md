# Meztli partner relay

A Cloudflare Worker that passes **end-to-end-encrypted** partner updates from
the owner's phone to the partner's phone. It stores one opaque blob per couple
and cannot read it: the key exists only on the two phones, agreed in person
during pairing (QR code or 6-character code + a 4-word phrase both people check).

What the relay can still see: IP addresses, when an update is sent, and that
two devices share a mailbox. Blobs are padded to a fixed size, so it cannot
see how much was shared. Request logs are off (`[observability] enabled = false`).

## Deploy (free tier is plenty)

```sh
cd workers/relay
npx wrangler login          # your Cloudflare account
pnpm install
pnpm deploy                 # prints https://meztli-relay.<you>.workers.dev
```

Then build the app with that URL:

```sh
echo "VITE_RELAY_URL=https://meztli-relay.<you>.workers.dev" > app/.env
pnpm --filter @meztli/app native:sync
```

The URL can also be entered in the app under You → Partner → Relay.

## API (all JSON)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/box/:id` | — | Owner creates a mailbox with token hashes |
| POST | `/v1/pair/:code` | — | Owner posts a 3-minute pairing offer |
| GET | `/v1/pair/:code` | — | Partner reads the offer (single use) |
| POST | `/v1/pair/:code/answer` | — | Partner posts its public key |
| GET | `/v1/pair/:code/answer` | write token | Owner reads the answer |
| PUT | `/v1/box/:id` | write token | Owner uploads a sealed snapshot (version must increase) |
| GET | `/v1/box/:id` | read token | Partner downloads it |
| DELETE | `/v1/box/:id` | write token | Revoke: wipes the blob, leaves a tombstone |

Idle mailboxes delete themselves after 60 days.
