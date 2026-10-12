import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LabResult, LabStatus } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { colors, shadows, spacing } from '@/theme';
import { labStatusAt } from '@/utils/lab';
import { AppText, Badge, Card, type BadgeTone } from './ui';

const BADGE_TONE: Record<LabStatus, BadgeTone> = {
  NORMAL: 'success',
  BORDERLINE: 'warning',
  HIGH: 'danger',
  LOW: 'info',
};

const DOT_COLOR: Record<LabStatus, string> = {
  NORMAL: colors.success,
  BORDERLINE: colors.warning,
  HIGH: colors.danger,
  LOW: colors.info,
};

const DOT_SPACE = 9;
const DOT_SIZE = 6;
const MARKER_SIZE = 16;
const TICK_WIDTH = 52;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** One measurement: its name, the value, a status label and where the value sits on its scale. */
export function LabResultCard({ result }: { result: LabResult }) {
  const { t, language } = useI18n();
  const value = formatNumber(result.value, language);
  const status = t(`lab.status.${result.status}`);
  return (
    <Card>
      <View accessible accessibilityLabel={`${result.name}: ${value} ${result.unit}, ${status}`} style={styles.content}>
        <AppText variant="bodyStrong" color={colors.textSecondary} numberOfLines={2}>
          {result.name}
        </AppText>
        <View style={styles.valueRow}>
          <View style={styles.value}>
            <AppText variant="display">{value}</AppText>
            {result.unit ? (
              <AppText variant="body" color={colors.textMuted}>
                {result.unit}
              </AppText>
            ) : null}
          </View>
          <Badge label={status} tone={BADGE_TONE[result.status]} />
        </View>
        <LabScale result={result} />
      </View>
    </Card>
  );
}

/**
 * The scale under a value: a row of dots coloured by the lab's ranges. The dots in the value's
 * own range are stronger and a bigger dot marks the value. The numbers below are where ranges
 * change.
 */
function LabScale({ result }: { result: LabResult }) {
  const { language } = useI18n();
  const [width, setWidth] = useState(0);
  const { scaleMin, scaleMax, ranges, value } = result;
  const span = scaleMax - scaleMin;
  const at = (point: number) => clamp((point - scaleMin) / span, 0, 1);

  const count = Math.max(12, Math.floor(width / DOT_SPACE));
  const own = labStatusAt(value, ranges);
  const marker = Math.min(count - 1, Math.floor(at(value) * count));

  // Where ranges change, left to right, skipping numbers that would run into each other.
  const ticks: { at: number; label: string }[] = [];
  for (const range of ranges) {
    if (range.to === null || range.to <= scaleMin || range.to >= scaleMax) continue;
    const x = at(range.to) * width;
    const last = ticks[ticks.length - 1];
    if (!last || x - last.at * width >= TICK_WIDTH - 12) {
      ticks.push({ at: at(range.to), label: formatNumber(range.to, language) });
    }
  }

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.scale}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.rail}>
        {width > 0
          ? Array.from({ length: count }, (_, index) => {
              const status = labStatusAt(scaleMin + ((index + 0.5) / count) * span, ranges);
              const isMarker = index === marker;
              return (
                <View key={index} style={styles.cell}>
                  <View
                    style={
                      isMarker
                        ? [styles.marker, { backgroundColor: DOT_COLOR[own] }]
                        : [styles.dot, { backgroundColor: DOT_COLOR[status], opacity: status === own ? 0.65 : 0.2 }]
                    }
                  />
                </View>
              );
            })
          : null}
      </View>
      <View style={styles.ticks}>
        {width > 0
          ? ticks.map((tick) => (
              <AppText
                key={tick.label}
                variant="small"
                color={colors.textSecondary}
                align="center"
                style={[styles.tick, { left: clamp(tick.at * width - TICK_WIDTH / 2, 0, Math.max(0, width - TICK_WIDTH)) }]}
              >
                {tick.label}
              </AppText>
            ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs + 2,
    flexShrink: 1,
  },
  scale: {
    marginTop: spacing.sm,
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MARKER_SIZE,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.card,
  },
  ticks: {
    height: 18,
    marginTop: 4,
  },
  tick: {
    position: 'absolute',
    width: TICK_WIDTH,
  },
});
