import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, borderRadius, spacing, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface Props {
  closedReports: number;
  notHalalReports: number;
  verificationCount?: number;
  compact?: boolean;
}

/**
 * Calculates a confidence percentage based on report count.
 * Uses a logarithmic curve: 1 report = 30%, 2 = 50%, 3 = 65%, 5 = 80%, 10+ = 95%
 */
function reportConfidence(count: number): number {
  if (count <= 0) return 0;
  return Math.min(95, Math.round(30 + 25 * Math.log2(count)));
}

type TrustStatus = 'clean' | 'caution' | 'warning' | 'danger';

function getTrustStatus(closedReports: number, notHalalReports: number): TrustStatus {
  const maxPct = Math.max(reportConfidence(closedReports), reportConfidence(notHalalReports));
  if (maxPct === 0) return 'clean';
  if (maxPct < 50) return 'caution';
  if (maxPct < 65) return 'warning';
  return 'danger';
}

function getStatusConfig(c: AppColors): Record<TrustStatus, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}> {
  return {
    clean: {
      icon: 'shield-checkmark',
      color: c.success,
      label: 'No recent reports',
    },
    caution: {
      icon: 'information-circle',
      color: c.warning,
      label: '',
    },
    warning: {
      icon: 'warning',
      color: c.warning,
      label: '',
    },
    danger: {
      icon: 'warning',
      color: c.error,
      label: '',
    },
  };
}

/**
 * Compact trust snapshot for PlaceCard list items.
 * Always visible — shows either "no reports" or the warning.
 */
function CompactSnapshot({ closedReports, notHalalReports, verificationCount = 0 }: Props) {
  const { colors: c } = useTheme();
  const compactStyles = React.useMemo(() => createCompactStyles(c), [c]);
  const status = getTrustStatus(closedReports, notHalalReports);
  const config = getStatusConfig(c)[status];

  if (status === 'clean') {
    return (
      <View style={[compactStyles.badge, { backgroundColor: config.color + '12' }]}>
        <Ionicons name={config.icon} size={12} color={config.color} />
        <Text style={[compactStyles.text, { color: config.color }]}>
          {verificationCount > 0
            ? `No reports · ${verificationCount} ${verificationCount === 1 ? 'verification' : 'verifications'}`
            : 'No recent reports'}
        </Text>
      </View>
    );
  }

  // Build warning labels
  const parts: string[] = [];
  if (closedReports > 0) {
    const pct = reportConfidence(closedReports);
    parts.push(`${pct}% may be closed`);
  }
  if (notHalalReports > 0) {
    const pct = reportConfidence(notHalalReports);
    parts.push(`${pct}% halal disputed`);
  }

  return (
    <View style={[compactStyles.badge, { backgroundColor: config.color + '12' }]}>
      <Ionicons name={config.icon} size={12} color={config.color} />
      <Text style={[compactStyles.text, { color: config.color }]}>
        {parts.join(' · ')}
      </Text>
    </View>
  );
}

const createCompactStyles = (_c: AppColors) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});

/**
 * Full warning banner for the place detail screen.
 * Shows report counts and confidence percentages.
 */
export function ReportWarning({
  closedReports,
  notHalalReports,
  verificationCount = 0,
  compact = false,
}: Props) {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);

  if (compact) {
    return (
      <CompactSnapshot
        closedReports={closedReports}
        notHalalReports={notHalalReports}
        verificationCount={verificationCount}
      />
    );
  }

  const closedPct = reportConfidence(closedReports);
  const notHalalPct = reportConfidence(notHalalReports);

  if (closedPct === 0 && notHalalPct === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="warning" size={16} color={c.warning} />
        <Text style={styles.title}>Community Reports</Text>
      </View>

      {closedReports > 0 && (
        <WarningRow
          icon="close-circle"
          label="Possibly closed"
          count={closedReports}
          confidence={closedPct}
        />
      )}
      {notHalalReports > 0 && (
        <WarningRow
          icon="alert-circle"
          label="Halal status disputed"
          count={notHalalReports}
          confidence={notHalalPct}
        />
      )}
      <Text style={styles.disclaimer}>
        Based on {closedReports + notHalalReports} community {closedReports + notHalalReports === 1 ? 'report' : 'reports'}. Verify on arrival.
      </Text>
    </View>
  );
}

function WarningRow({
  icon,
  label,
  count,
  confidence,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  confidence: number;
}) {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const barColor = confidence >= 65 ? c.error : c.warning;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Ionicons name={icon} size={18} color={barColor} />
        <Text style={[styles.label, { color: barColor }]}>{label}</Text>
        <Text style={styles.count}>
          {count} {count === 1 ? 'report' : 'reports'}
        </Text>
      </View>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <View
            style={[
              styles.barFill,
              {
                width: `${confidence}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.pct, { color: barColor }]}>{confidence}%</Text>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: c.warning + '08',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.warning + '25',
    padding: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    ...typography.label,
    color: c.warning,
    fontSize: 13,
  },
  row: {
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    ...typography.label,
    fontSize: 13,
    flex: 1,
  },
  count: {
    ...typography.caption,
    color: c.textTertiary,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingStart: 24,
  },
  barBackground: {
    flex: 1,
    height: 6,
    backgroundColor: c.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  pct: {
    ...typography.caption,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  disclaimer: {
    ...typography.caption,
    color: c.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
