# web/ — halalnomad.travel landing page

Single-page static site for the public face of HalalNomad. No build
step, no framework. Plain HTML + CSS + ~50 lines of vanilla JS for the
waitlist form.

## What's here

```
web/
├── index.html       # The whole page
├── styles.css       # All styling
├── app.js           # Waitlist form (POSTs to Supabase)
├── assets/
│   ├── favicon.svg      # Browser tab icon
│   └── og-image.svg     # Social share card (1200x630)
└── README.md
```

## Deployment — Cloudflare Pages

The recommended path. Free, fast, custom domain + auto SSL, no build
config needed.

### One-time setup

1. **Run the waitlist migration** in Supabase SQL Editor — paste
   [`app/src/lib/migration-009-waitlist.sql`](../app/src/lib/migration-009-waitlist.sql)
   and run.

2. **Convert OG image to PNG** (X/Twitter strictly requires raster):
   ```bash
   # Option A — rsvg-convert (brew install librsvg)
   rsvg-convert -w 1200 -h 630 web/assets/og-image.svg \
     -o web/assets/og-image.png

   # Option B — Apple Preview / any browser → screenshot at 2x
   ```
   Commit the resulting `og-image.png` alongside the `.svg`.

3. **Cloudflare Pages — connect the repo:**
   - dash.cloudflare.com → Pages → Create a project
   - Connect to GitHub, select `mdnaeem95/halalnomad`
   - Production branch: `main`
   - Build command: *(leave empty)*
   - Build output directory: `web`
   - Root directory: *(leave empty / repo root)*
   - Save & Deploy

4. **Custom domain:**
   - Pages project → Custom domains → Add custom domain
   - Enter `halalnomad.travel`
   - Cloudflare will auto-add a CNAME (you'll need to update GoDaddy
     nameservers to Cloudflare's, OR add the CNAME at GoDaddy:
     `halalnomad.travel CNAME <project>.pages.dev`)
   - SSL provisions automatically within ~5 min

5. **Verify** — visit `halalnomad.travel`, scroll, submit a test email,
   check `select * from waitlist` in Supabase to confirm it landed.

### Subsequent deploys

Push to `main`. Cloudflare auto-deploys every commit to `web/`. There's
no build, so deploy time is ~10 seconds.

## Local development

```bash
cd web
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000`. The form will fail locally because the
Supabase RLS check probably needs the production Origin — that's fine
to test on the deployed Pages preview URL or the prod domain.

## Reading the waitlist

```sql
-- Most recent first
select email, source, created_at
from waitlist
order by created_at desc
limit 50;

-- Count
select count(*) from waitlist;
```

RLS prevents anyone except the service role from reading. Anonymous /
public users can only insert their own email (insert-only policy).

## Updating content

Most edits are HTML in `index.html`. Common ones:

- **City list** — search for `class="city-grid"` and add/remove `<span class="city-chip">…</span>`
- **Tagline** — search for `<h1>` in the hero
- **Pillars** — search for `class="pillar"` (4 cards)
- **Footer links** — search for `class="footer-links"`

When the iOS app goes live, swap the disabled `<span class="store-badge">`
for a real `<a href="https://apps.apple.com/app/halalnomadXXX">…</a>`
that links to the App Store listing.

## Things deliberately not here

- No build step / npm packages — keeps deploys instant + diffable
- No analytics / tracking pixels yet — add post-launch when there's
  signal to measure (PostHog snippet in the head, ~5 lines)
- No newsletter / blog — Phase 3 territory per business roadmap
- No press kit / for-brands page — premature

When the time comes for any of these, they're 30-min additions.
