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
