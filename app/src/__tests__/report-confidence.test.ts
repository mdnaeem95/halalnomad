/**
 * Tests for the report confidence algorithm.
 * The function is defined inline in ReportWarning.tsx — we test the same logic here.
 */

// Replicate the function since it's not exported
function reportConfidence(count: number): number {
  if (count <= 0) return 0;
  return Math.min(95, Math.round(30 + 25 * Math.log2(count)));
}

describe('reportConfidence', () => {
  it('returns 0 for no reports', () => {
    expect(reportConfidence(0)).toBe(0);
  });

  it('returns 0 for negative reports', () => {
    expect(reportConfidence(-1)).toBe(0);
  });

  it('returns 30% for 1 report', () => {
    expect(reportConfidence(1)).toBe(30);
  });

  it('returns 55% for 2 reports', () => {
    expect(reportConfidence(2)).toBe(55);
  });

  it('returns ~70% for 3 reports', () => {
    const pct = reportConfidence(3);
    expect(pct).toBeGreaterThanOrEqual(65);
    expect(pct).toBeLessThanOrEqual(75);
  });

  it('returns ~88% for 5 reports', () => {
    const pct = reportConfidence(5);
    expect(pct).toBeGreaterThanOrEqual(80);
    expect(pct).toBeLessThanOrEqual(90);
  });

  it('caps at 95% even with many reports', () => {
    expect(reportConfidence(100)).toBe(95);
    expect(reportConfidence(1000)).toBe(95);
  });

  it('increases monotonically', () => {
    let prev = 0;
    for (let i = 0; i <= 20; i++) {
      const current = reportConfidence(i);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });
});
