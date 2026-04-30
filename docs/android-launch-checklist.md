# Android launch checklist

End-to-end runbook for taking HalalNomad from "iOS-only" to "live on
Google Play." Mirrors the iOS pattern in
[app-store-checklist.md](app-store-checklist.md) but covers the
Android-specific gotchas (FCM, data safety, mandatory 14-day closed
test for individual developer accounts).

**Estimated calendar time:** 14–17 days from kickoff to prod, dominated
by the closed-testing clock. Active work is ~3 days.

**Estimated active work:** ~3 days, mostly forms and assets.

---

## Phase 0 — Code fixes before the first Android build

These are small but should land before EAS Build runs to avoid
re-builds.

- [ ] **Dedupe Android permissions in [app.json](../app/app.json).**
      Currently each of `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
      `CAMERA`, `RECORD_AUDIO` is listed twice. Clean to one each.
      Drop `RECORD_AUDIO` entirely unless we actually need mic access
      (we don't — kept by accident from a template).
- [ ] **Fix [eas.json](../app/eas.json) submit config.**
      The current `serviceAccountKeyPath: "./google-services.json"` is
      wrong. `google-services.json` is the FCM client config (used at
      build time, baked into the APK). The submit step needs a Google
      Cloud **service account JSON** (different file, used at submit
      time to authenticate to the Play Developer API). Rename to
      `play-service-account.json` and add it to `.gitignore`.
- [ ] **Restrict the Google Maps API key per-platform.** The same key
      `AIzaSyDytPqAN0RbRt3_jytvLLdIiODyN8dJXCM` is used for iOS and
      Android in app.json. Either restrict the existing key to allow
      both `com.halalnomad.app` (Android package + SHA-1) and the iOS
      bundle ID, or — preferred — generate a separate Android key in
      Google Cloud Console and swap it in. The Android key needs the
      release SHA-1 fingerprint (get from EAS after first build:
      `eas credentials -p android`).

---

## Phase 1 — Pre-flight accounts and projects

One-time setup, ~1 hour total.

- [ ] **Google Play Developer account** — $25 one-time fee.
      Register at https://play.google.com/console. Use the same email
      as the Apple Developer account for consistency
      (`naeemsani95@gmail.com`).
- [ ] **Verify identity in Play Console.** Required for new accounts
      since 2023 (passport / driver's license upload). Can take a few
      days — kick off Day 1.
- [ ] **Create Firebase project** — for FCM push notifications.
      `https://console.firebase.google.com` → "Add project" → name it
      "HalalNomad". Skip Google Analytics (we use PostHog).
- [ ] **Add Android app to Firebase project.** Package name
      `com.halalnomad.app`. Download `google-services.json` to
      `app/google-services.json` (gitignored).
- [ ] **Create Play Console service account** for EAS Submit.
      Play Console → Settings → API access → "Create new service
      account" → grant "Release Manager" role for the HalalNomad app.
      Download the JSON, save as `app/play-service-account.json`
      (gitignored).
- [ ] **Add both files to `.gitignore`** (verify they're not staged
      before committing). They contain credentials — never commit.

---

## Phase 2 — First Android build (smoke test)

Get a working APK on your own Android device before bothering with
listing copy.

- [ ] **Run development build for testing.**
      `cd app && eas build --profile development --platform android`
      Install on a personal Android device (sideload). Verify:
      - App opens, splash → onboarding renders
      - Sign-in works (email confirm flow + magic link)
      - Map loads with Google Maps tiles (no grey checkerboard = key
        is correctly restricted)
      - Confirm Halal works (writes to Supabase)
      - Push notification arrives (test with a Confirm Halal action
        from another account)
- [ ] **Run production build.**
      `cd app && eas build --profile production --platform android`
      Produces an `.aab` (Android App Bundle) — the format Play Store
      requires. This is what gets uploaded.

---

## Phase 3 — Play Console: create the app

~30 minutes.

- [ ] **Create app** in Play Console → "Create app" → name
      "HalalNomad", default language English (US), app or game = App,
      free or paid = Free.
- [ ] **Confirm declarations** (the 4 mandatory checkboxes about
      developer policies, US export laws, etc).
- [ ] **App access** — set to "All functionality available without
      special access" since the app works without a paid login. If
      sign-in is required for any flow, provide the reviewer
      account: `reviewer@halalnomad.travel` (per CLAUDE.md).
- [ ] **Ads** → "No, my app does not contain ads." (Hard rule per
      CLAUDE.md.)
- [ ] **Content rating** — fill out the IARC questionnaire. We're a
      utility app with no violence/sex/gambling/etc. Should land at
      "Everyone."
- [ ] **Target audience** → 18+ (consistent with App Store rating).
      Or 13+ if we want broader reach — check what we set for iOS.
- [ ] **News app declaration** → No.
- [ ] **COVID-19 contact-tracing declaration** → No.
- [ ] **Government app declaration** → No.

---

## Phase 4 — Data safety form

Equivalent to App Store privacy nutrition labels but more granular.
Allow ~30 min. Be specific — wrong answers trigger a re-review.

- [ ] **Data collected from users:**
      - Email address (for auth) — required, not shared, encrypted in
        transit, user can request deletion
      - Approximate location — required for nearby places, not shared,
        encrypted in transit
      - Precise location — optional, only when user grants permission
      - Photos — uploaded by user when adding a place / reviewing
      - User ID — Supabase user UUID, internal only
- [ ] **Data collected automatically:**
      - Crash logs (Sentry) — required for app functionality, not
        shared, anonymised
      - Diagnostics / app activity (PostHog) — optional, used for
        analytics
- [ ] **Data sharing with third parties:** None for marketing. Service
      providers (Supabase / Sentry / PostHog / RevenueCat — list each
      with their privacy policy URL).
- [ ] **Data deletion** — declare that users can delete their account
      via the in-app Settings flow. Verify this actually works on
      Android before declaring.

---

## Phase 5 — Listing assets

The marketing surface. ~2 hours design time.

- [ ] **App icon** — 512×512 PNG, already have it
      ([assets/icon.png](../app/assets/icon.png)).
- [ ] **Feature graphic** — 1024×500 PNG. Use the wordmark on cream
      background, centered. Render via `planning/logos/export-pngs.sh`
      with adjusted dimensions, or design fresh in Figma. **This shows
      at the top of the Play Store listing — don't skip.**
- [ ] **Phone screenshots** — at least 2, ideally 4–8, in 9:16 ratio.
      Use a real iPhone running Android via screenshot mock OR build
      on an Android emulator and screenshot the actual app. Cover:
      Map view, List view, Browse view, Place detail, Add place flow.
      Same screenshots can largely be reused from the App Store with
      minimal adjustments (different aspect ratio).
- [ ] **Tablet screenshots** — optional but boosts discoverability.
      Skip for v1.
- [ ] **Short description (≤80 chars):**
      "Verified Halal restaurants for Muslim travellers. 13 cities,
      growing." (78 chars)
- [ ] **Full description (≤4000 chars)** — adapt the App Store
      description. Verify no Apple-specific language ("App Store",
      "iPhone", "iCloud") — replace with "Google Play" / "your phone"
      / generic. Apple cares about this; Google doesn't, but
      symmetry helps maintainability.
- [ ] **Category** → Travel & Local (primary) or Food & Drink
      (alternative — A/B mentally and pick one).
- [ ] **Tags** — pick from the predefined list. Suggest:
      Halal, Muslim travel, Restaurant finder, Food discovery, Travel
      guide.
- [ ] **Privacy policy URL** — `https://halalnomad.travel/privacy`
      (verify this exists; create if not — copy from iOS submission).
- [ ] **Support email** — `support@halalnomad.travel` per CLAUDE.md.
- [ ] **Website** — `https://halalnomad.travel`.

---

## Phase 6 — Closed testing (the 14-day clock)

Google Play requires individual developer accounts to run a closed
test for **at least 14 days** with **12+ active testers** before they
can promote to production. This is the calendar bottleneck.

- [ ] **Create closed testing track** in Play Console → Testing →
      Closed testing → "Create new track" → name it "Beta".
- [ ] **Upload the .aab** built in Phase 2 to the Beta track.
      Release name: `1.0.0 (1)`. Release notes: "First Android beta —
      please report any issues to support@halalnomad.travel."
- [ ] **Create tester list** of 12+ Gmail-account holders. Recruit:
      - 5 from your "first 50" personal network
      - 5 from the halalnomad.travel waitlist (filter for Android
        users)
      - 2 from Reddit r/halal (post a "looking for Android beta
        testers" thread the day you submit)
- [ ] **Add testers via Google Group** (recommended over individual
      emails — easier to add/remove later). Create group at
      `groups.google.com`, name it `halalnomad-android-beta@...`.
- [ ] **Send opt-in URL to testers.** Play Console gives you a URL
      like `https://play.google.com/apps/testing/com.halalnomad.app`.
      Testers must click → "Become a tester" → install via Play Store.
      Track who's actually opted in via the Play Console dashboard.
- [ ] **Day 1 of 14:** verify ≥12 testers are showing as "active" in
      the dashboard. The clock doesn't start until that count is hit.
- [ ] **Daily lightweight check-ins** with testers (Slack / WhatsApp
      group). Goal: at least 1 meaningful interaction per tester per
      week so they show as active.
- [ ] **Mid-test bug fixes** are fine — push new builds via OTA
      (`eas update`) without uploading new .aab. Only upload a new
      .aab if there's a native-side change.
- [ ] **End of Day 14:** confirm in Play Console that the
      "Production" promotion option is unlocked.

---

## Phase 7 — Production launch

The actual release. ~30 min of forms + however long Google's review
takes (usually <24h for an app that's already been beta-tested).

- [ ] **Create production release** in Play Console → Production →
      "Create new release" → "Promote release from Beta."
- [ ] **Release notes (≤500 chars):**
      "v1.0 — HalalNomad on Android. Verified Halal restaurants for
      Muslim travellers across 13 Asian cities, with offline-friendly
      caching, multi-language support, and community verification.
      Built by a Muslim traveller, for Muslim travellers."
- [ ] **Staged rollout** — start at 20%. Increase to 50% after 48h if
      crash-free rate >99.5%. Full rollout after 5 days.
- [ ] **Monitor Play Console → Quality → Android vitals** for the
      first week. Watch ANR rate, crash rate, slow rendering, slow
      startup. Anything >1% needs investigation.
- [ ] **Update [docs/release.md](release.md)** with the Android
      release flow once you've done it once — capture the actual
      gotchas as they happen.

---

## Recurring Android-specific maintenance

After launch, ongoing.

- **Each new release** — increment `versionCode` (Android's
  monotonic int) and `versionName`. EAS handles `versionCode`
  auto-increment with `autoIncrement: true` already set in
  [eas.json](../app/eas.json). For bigger releases, bump
  `versionName` manually.
- **OTA updates** — same pattern as iOS. The runtime version policy
  is `appVersion` so an OTA only matches builds with the same
  `versionName`.
  ```bash
  npx eas-cli update --branch production --platform android --message "..."
  # Or both platforms at once:
  npx eas-cli update --branch production --platform all --message "..."
  ```
- **Quarterly:** re-check Play Console policy updates. Google ships
  developer policy changes quarterly and can email opaque "you're in
  violation" warnings if missed.

---

## Tripwires

If any of these fire, pause and re-plan.

- **Play Console identity verification rejected** — usually fixable
  with clearer document scans. Submit again. If rejected twice,
  contact Play support directly.
- **Beta testers <12 active by day 7** — recruit aggressively;
  consider lowering bar by adding personal contacts. The clock
  doesn't start until 12 are active.
- **First production release crash rate >2%** — pause the rollout in
  Play Console (you can stop a staged rollout mid-flight). Fix and
  re-release.
