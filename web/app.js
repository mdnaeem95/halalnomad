// HalalNomad landing page — waitlist form + small UX polish.
// No build step, no framework. Vanilla JS hits the Supabase REST API
// directly with the anon key (which is safe to ship to the browser by
// design — RLS on the waitlist table only allows inserts).

(function () {
  // -- Config (these are public; safe in client-side JS) -------------------
  const SUPABASE_URL = 'https://aytvorjaetitthzuijkv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ypDMapdKPfnENy4E7l010w_DmTCj_6f';

  // -- Year in footer ------------------------------------------------------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // -- Waitlist form -------------------------------------------------------
  const form = document.getElementById('waitlist-form');
  const status = document.getElementById('waitlist-status');
  if (!form || !status) return;

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = 'waitlist-status' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');
    const email = (input.value || '').trim().toLowerCase();

    // Basic validation — server will validate authoritatively.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('That email looks off. Mind double-checking?', 'error');
      input.focus();
      return;
    }

    button.disabled = true;
    setStatus('Adding you…', '');

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          email,
          source: 'landing_page',
          user_agent: navigator.userAgent.slice(0, 256),
        }),
      });

      if (response.status === 201 || response.ok) {
        setStatus("You're on the list. We'll email when we go live — single message, no newsletter.", 'success');
        input.value = '';
        return;
      }

      // 409 Conflict = duplicate email (unique constraint). Treat as success.
      if (response.status === 409) {
        setStatus("You're already on the list. Sit tight.", 'success');
        return;
      }

      const errText = await response.text();
      console.warn('Waitlist insert failed:', response.status, errText);
      setStatus('Something went wrong. Try again in a sec?', 'error');
    } catch (err) {
      console.warn('Waitlist network error:', err);
      setStatus('Network error. Try again?', 'error');
    } finally {
      button.disabled = false;
    }
  });
})();
