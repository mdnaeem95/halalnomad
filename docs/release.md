# Release process

A production iOS release is **two artifacts**:

1. **Binary** produced by `eas build` — contains the native shell + a JS bundle baked in
2. **OTA update** produced by `eas update` — a JS bundle served at runtime by `expo-updates`

When both exist for the same runtime version, **the OTA wins.** That is,
the binary's own JS is only the fallback used when there's no matching OTA
(or on very first launch before the OTA is downloaded). If you ship a new
binary but the previous OTA is still pointing at old code, every install of
the new binary will download and run the old OTA — the new native changes
ship, but your JS changes don't. **Publish an OTA matching every new build.**

## The one-liner

From `app/`:

```bash
./scripts/release-prod.sh "short release message"
```

It runs `eas build --platform ios --profile production` then, if the build
succeeds, `eas update --branch production` with the same message. If the
build fails, no OTA is published.

## Staging gate (preview channel)

Before promoting anything to production, validate it on the **`preview`**
channel. There are two EAS channels, defined in `eas.json`:

| Channel | Build profile | Who runs it | Promoted via |
|---|---|---|---|
| `preview` | `preview` (internal dist) | the test device(s) | `release-preview.sh` |
| `production` | `production` (App Store) | real users | `release-prod.sh` |

Day-to-day flow for a JS-only change (which is most changes):

```bash
cd app

# 1. Publish to preview, validate on the test device.
./scripts/release-preview.sh "short message"

# 2. Once it checks out, promote the SAME commit to production.
./scripts/release-prod.sh "short message"
```

One-time (or after any native change — new dep, app.json, runtimeVersion bump):
cut a preview binary and install it on the test device, after which it keeps
receiving preview OTAs:

```bash
./scripts/release-preview.sh --with-build "short message"
```

**What this does and doesn't isolate.** The channel split isolates the **JS
bundle** — testers run preview JS, users run production JS, independently. It
does **not** isolate **data**: both channels point at the **same Supabase
project** (one `SUPABASE_URL`). So preview writes hit the production DB (fine
for user-scoped, RLS-owned data with a test account) and **schema migrations
are still run by hand in prod Supabase regardless of channel** — there is no
staging database. If you ever need that, it's a separate Supabase project keyed
off `APP_ENV`, which is a deliberate, separate setup — not part of this gate.

Same OTA discipline applies: a preview OTA only reaches a device whose installed
build is on the `preview` channel **and** matches the current `runtimeVersion`.
Native changes need a fresh `--with-build`.

## Manual two-step (if you need control)

```bash
cd app

# 1. Build the native binary (~15 min).
#    The JS bundled inside will be whatever's in your working tree at this moment.
npx eas-cli build --platform ios --profile production

# 2. Publish an OTA matching the same commit.
#    Run AFTER the build finishes, from the same commit.
npx eas-cli update --branch production --platform ios --message "..."
```

Then:

```bash
npx eas-cli submit --platform ios --latest
```

## Why this setup exists

`expo-updates` is configured in `app.json`:

```json
"updates": { "url": "https://u.expo.dev/<project-id>" },
"runtimeVersion": { "policy": "appVersion" }
```

- `runtimeVersion: { policy: "appVersion" }` ties OTAs to the version string
  in `app.json` (currently `1.0.0`). As long as you don't bump that, OTAs
  keep matching.
- Any OTA published to the `production` channel for runtime `1.0.0` will be
  served to every production build at runtime `1.0.0`.
- Build numbers (1.0.0 (8), 1.0.0 (9)…) are cosmetic to Apple — they don't
  affect OTA matching.

## What went wrong on build 8 (for posterity)

We pushed "Initial release" to the production channel before the IAP fix,
dark mode fix, and Google Play removal landed. Every subsequent build
downloaded that stale OTA on launch and ran it instead of the (correct)
bundled JS. Symptoms: new builds that looked identical to old ones, IAP
failures, fallback $29.99/$4.99 prices. Fix: publish a fresh OTA pointing
at current main (commit 93004c6).

## Checklist before running a production release

- [ ] Validated on the `preview` channel / test device (`release-preview.sh`)
- [ ] Working tree clean, latest changes pushed to `main`
- [ ] `npx tsc --noEmit` passes in `app/`
- [ ] Any SQL migrations run in Supabase
- [ ] Native deps changed since last build? (new package, version bump —
      if yes, build is required; if no, OTA alone would suffice for
      JS-only changes)
- [ ] Sandbox Apple ID ready on your test device

## JS-only fix workflow (no native rebuild needed)

Fix a bug in TypeScript/JSX only? Skip the binary:

```bash
cd app
npx eas-cli update --branch production --platform ios --message "short fix description"
```

Users get the update within a few launches. No App Review needed — this
is the whole point of `expo-updates`. The built binary on disk stays as a
fallback.

**Don't** use JS-only OTA for anything that changes:

- Native dependencies or their versions
- `app.json` (permissions, bundle ID, URL schemes, plugins)
- The `runtimeVersion` string
- App icons or splash
- Anything that needs App Review re-approval (new permissions, new content)

Those need a full rebuild + re-review.

## Rollback

OTAs on a given branch are versioned. To roll back, point the `production`
channel at a previous update group:

```bash
npx eas-cli channel:edit production
# → follow the prompt to re-point at an earlier update group ID
```

Or just publish a fresh OTA from the last-known-good commit.

## Forgetting the OTA is the main failure mode

It's easy to `eas build`, forget the `eas update`, submit to Apple, and
watch reviewers hit old code. The release script exists specifically to
make this one command. If you do anything manual, the mnemonic is:

> **Every production build gets an OTA. Every single time.**

## Operational gotchas (lessons paid for)

These caught us once each and shouldn't again:

### Metro cache pins stale `EXPO_PUBLIC_*` values

When you change an `EXPO_PUBLIC_*` env var (e.g. swapping a RevenueCat
key from `test_` to `goog_`) and immediately `eas update`, the inlined
value can carry over from a previous bundle. Cause: `babel-preset-expo`
caches the env-var substitution in `$TMPDIR/metro-cache` and Metro's
content hashing doesn't notice the env change. Symptom: bundle hash
doesn't change between consecutive publishes; the OTA gets shipped but
contains the old key.

**Fix before the OTA, whenever an env var changed:**

```bash
rm -rf "$TMPDIR/metro-cache" "$TMPDIR/metro-file-map-"*
rm -rf dist/
npx eas-cli update --branch production --platform <ios|android> --message "…"
```

Then verify the change actually landed by `strings dist/_expo/static/js/<plat>/index-*.hbc | grep <expected-value>`.

### `--platform all` requires `react-native-web`

`eas update --platform all` tells Expo's export step to bundle every
platform declared in `expo.platforms` — which (by default) includes
web. If `react-native-web` isn't installed (it isn't in our setup), the
whole publish aborts before either mobile platform lands.

Until web support is real, **publish iOS and Android in two separate
commands**:

```bash
CI=1 npx eas-cli update --branch production --platform ios --message "…"
CI=1 npx eas-cli update --branch production --platform android --message "…"
```

(The `CI=1` env hint replaces the deprecated `--non-interactive` flag —
eas-cli logs a warning if you use the old one.)

### Three OTAs ≠ three releases

EAS Update auto-serves the **latest** update group on a runtime; older
ones become unreachable. We had a stretch where a single bad-bundle bug
got published 3× in a row (RC key episode) — devices only ever saw the
last one. Don't waste mental energy on the bad publishes. The fix is
the last successful update group, full stop.
