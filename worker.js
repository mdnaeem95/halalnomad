/**
 * halalnomad.travel — Worker for dynamic routing over Workers Static Assets.
 *
 * The only dynamic path is the trip share link: /trip/<token> must serve the
 * static, trip-agnostic web/trip.html for ANY token (M4, 2026-08). Everything
 * else falls through to the static asset behaviour unchanged.
 *
 * ⚠ DEPLOY NOTE: adding this promotes the site from assets-only to
 * worker+assets. To activate, wrangler.toml needs:
 *     main = "worker.js"
 *     [assets]
 *     directory = "./web"
 *     binding   = "ASSETS"          # (added — lets the Worker call assets)
 *     not_found_handling = "none"
 * Verify the connected Cloudflare project builds the Worker (a bad deploy takes
 * the whole live site down — there is no web staging). `wrangler dev` locally
 * first, or watch the first prod deploy and be ready to revert.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Serve the static share landing for every /trip/<token> path. Fetch the
    // CLEAN path (/trip, not /trip.html) — asset serving 307-redirects the
    // .html form to extensionless, so /trip.html would bounce; /trip serves
    // trip.html's content directly (200).
    if (/^\/trip\/[^/]+/.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(new URL('/trip', url), request));
    }
    // Everything else: default static-asset resolution (clean URLs, 404s).
    return env.ASSETS.fetch(request);
  },
};
