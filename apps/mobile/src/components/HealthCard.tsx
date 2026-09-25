import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

/** ISO/IEC 7810 ID-1: the size of a bank card. */
const CARD_ASPECT_RATIO = 85.6 / 53.98;

interface HealthCardProps {
  holderName: string;
  insurerName: string;
  planName: string;
  memberNumber: string;
  validThru: string;
}

function formatMemberNumber(value: string): string {
  return value.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function HealthCard({ holderName, insurerName, planName, memberNumber, validThru }: HealthCardProps) {
  return (
    // Shadow sits on an outer view: iOS clips shadows on views with overflow: 'hidden'.
    <View style={styles.shadow}>
      <LinearGradient
        colors={['#14B8A6', colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={[styles.circle, styles.circleTopRight]} />
        <View style={[styles.circle, styles.circleBottomLeft]} />

        <View style={styles.row}>
          <View>
            <View style={styles.brand}>
              <Ionicons name="medical" size={18} color={colors.white} />
              <Text style={styles.brandName}>Telehealth</Text>
            </View>
            <Text style={styles.insurer}>{insurerName}</Text>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{planName}</Text>
          </View>
        </View>

        <LinearGradient
          colors={['#F8E3A8', '#D8AE55']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chip}
        >
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
        </LinearGradient>

        <Text style={styles.memberNumber} accessibilityLabel={`Numri i anëtarit ${memberNumber}`}>
          {formatMemberNumber(memberNumber)}
        </Text>

        <View style={styles.row}>
          <View style={styles.holder}>
            <Text style={styles.fieldLabel}>MBAJTËSI I KARTËS</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {holderName.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.fieldLabel}>E VLEFSHME DERI</Text>
            <Text style={styles.fieldValue}>{validThru}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDark,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  card: {
    aspectRatio: CARD_ASPECT_RATIO,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.lg - 4,
    justifyContent: 'space-between',
  },
  circle: {
    position: 'absolute',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  circleTopRight: {
    width: 220,
    height: 220,
    top: -90,
    right: -70,
  },
  circleBottomLeft: {
    width: 180,
    height: 180,
    bottom: -100,
    left: -50,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  insurer: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  planText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  chip: {
    width: 46,
    height: 34,
    borderRadius: 7,
    justifyContent: 'space-evenly',
    paddingHorizontal: 6,
  },
  chipLine: {
    height: 1,
    backgroundColor: 'rgba(120, 85, 20, 0.35)',
  },
  memberNumber: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  holder: {
    flex: 1,
    marginRight: spacing.md,
  },
  fieldLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  fieldValue: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
