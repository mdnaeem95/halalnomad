import { TIER_THRESHOLDS, ContributorTier } from '../types';

// Replicate the pure function from useAuth to avoid importing Supabase chain
function getTierForPoints(points: number): ContributorTier {
  if (points >= TIER_THRESHOLDS.legend) return 'legend';
  if (points >= TIER_THRESHOLDS.ambassador) return 'ambassador';
  if (points >= TIER_THRESHOLDS.guide) return 'guide';
  return 'explorer';
}

describe('getTierForPoints', () => {
  it('returns explorer for 0 points', () => {
    expect(getTierForPoints(0)).toBe('explorer');
  });

  it('returns explorer for 199 points', () => {
    expect(getTierForPoints(199)).toBe('explorer');
  });

  it('returns guide at exactly 200 points', () => {
    expect(getTierForPoints(200)).toBe('guide');
  });

  it('returns guide for 999 points', () => {
    expect(getTierForPoints(999)).toBe('guide');
  });

  it('returns ambassador at exactly 1000 points', () => {
    expect(getTierForPoints(1000)).toBe('ambassador');
  });

  it('returns ambassador for 4999 points', () => {
    expect(getTierForPoints(4999)).toBe('ambassador');
  });

  it('returns legend at exactly 5000 points', () => {
    expect(getTierForPoints(5000)).toBe('legend');
  });

  it('returns legend for very high points', () => {
    expect(getTierForPoints(100000)).toBe('legend');
  });
});
