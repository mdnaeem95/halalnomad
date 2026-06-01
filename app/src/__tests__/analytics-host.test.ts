import { readFileSync } from 'fs';
import { join } from 'path';

// Don't construct a real PostHog client (or open any network) just to read
// the config — stub the SDK. We only care about the options we pass in.
jest.mock('posthog-react-native', () => ({ PostHog: jest.fn(() => ({})) }));

import { POSTHOG_HOST, POSTHOG_OPTIONS } from '../lib/analytics';

// Regression guard. The PostHog project is on EU Cloud (191007); the SDK
// defaults to the US region. We already shipped a silent US/EU mismatch
// once and events disappeared from the EU dashboard. These assertions fail
// CI if the host ever drifts back to US or the option gets dropped.
describe('PostHog EU host guard', () => {
  it('configures the EU ingest host', () => {
    expect(POSTHOG_HOST).toBe('https://eu.i.posthog.com');
    expect(POSTHOG_OPTIONS.host).toBe('https://eu.i.posthog.com');
  });

  it('never points at the US default region', () => {
    expect(POSTHOG_HOST).not.toMatch(/us\.i\.posthog\.com/);
    expect(POSTHOG_OPTIONS.host).not.toMatch(/us\.i\.posthog\.com/);
  });

  // Catches the subtle failure mode where someone refactors the init and
  // stops feeding POSTHOG_OPTIONS to the constructor (e.g. a wizard re-run
  // that inlines fresh options) — at which point the asserts above would
  // pass against an unused constant while the SDK quietly falls back to US.
  it('hands POSTHOG_OPTIONS to the PostHog constructor (no inline override)', () => {
    const src = readFileSync(join(__dirname, '../lib/analytics.ts'), 'utf8');
    expect(src).toMatch(/new PostHog\(\s*POSTHOG_API_KEY,\s*POSTHOG_OPTIONS\s*\)/);
    expect(src).not.toMatch(/us\.i\.posthog\.com/);
  });
});
