import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';
import type { Subscription } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatCardExpiry, formatCardNumber } from '@/i18n/format';
import { colors, gradients, radius, shadows, spacing } from '@/theme';
import { AppText } from './ui';

/** ISO/IEC 7810 ID-1: the size of a bank card. */
const CARD_ASPECT_RATIO = 85.6 / 53.98;

/** The digital health card: shown while the subscription is active. */
export function HealthCard({ holderName, subscription }: { holderName: string; subscription: Subscription }) {
  const { t } = useI18n();
  return (
    // The shadow sits on an outer view: iOS clips shadows on views with overflow: 'hidden'.
    <View style={styles.shadow}>
      <LinearGradient colors={gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={[styles.circle, styles.circleTopRight]} />
        <View style={[styles.circle, styles.circleBottomLeft]} />

        <View style={styles.row}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="medical" size={14} color={colors.primary} />
            </View>
            <View>
              <AppText variant="subhead" weight="800" color={colors.white}>
                {t('card.brand')}
              </AppText>
              <AppText variant="small" color="rgba(255,255,255,0.75)">
                {t(`subscription.source.${subscription.source}`)}
              </AppText>
            </View>
          </View>
          <View style={styles.planBadge}>
            <AppText variant="small" weight="800" color={colors.white} style={styles.planText}>
              {subscription.planName.toUpperCase()}
            </AppText>
          </View>
        </View>

        <View style={styles.middle}>
          <LinearGradient colors={['#F8E3A8', '#D8AE55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
            <View style={styles.chipLine} />
            <View style={styles.chipLine} />
            <View style={styles.chipLine} />
          </LinearGradient>
          <Ionicons name="wifi" size={22} color="rgba(255,255,255,0.7)" style={styles.contactless} />
        </View>

        <AppText style={styles.number} color={colors.white} accessibilityLabel={subscription.cardNumber}>
          {formatCardNumber(subscription.cardNumber)}
        </AppText>

        <View style={styles.row}>
          <View style={styles.holder}>
            <AppText variant="overline" color="rgba(255,255,255,0.7)" style={styles.fieldLabel}>
              {t('card.holder')}
            </AppText>
            <AppText variant="bodyStrong" color={colors.white} numberOfLines={1}>
              {holderName.toUpperCase()}
            </AppText>
          </View>
          <View>
            <AppText variant="overline" color="rgba(255,255,255,0.7)" style={styles.fieldLabel}>
              {t('card.validThru')}
            </AppText>
            <AppText variant="bodyStrong" color={colors.white}>
              {formatCardExpiry(subscription.endsAt)}
            </AppText>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.xl,
    backgroundColor: colors.primaryDeep,
    ...shadows.raised,
  },
  card: {
    aspectRatio: CARD_ASPECT_RATIO,
    borderRadius: radius.xl,
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
    width: 240,
    height: 240,
    top: -110,
    right: -70,
  },
  circleBottomLeft: {
    width: 200,
    height: 200,
    bottom: -120,
    left: -60,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  planText: {
    letterSpacing: 1.5,
  },
  middle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  chip: {
    width: 44,
    height: 32,
    borderRadius: 7,
    justifyContent: 'space-evenly',
    paddingHorizontal: 6,
  },
  chipLine: {
    height: 1,
    backgroundColor: 'rgba(120, 85, 20, 0.35)',
  },
  contactless: {
    transform: [{ rotate: '90deg' }],
  },
  number: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  holder: {
    flex: 1,
    marginRight: spacing.md,
  },
  fieldLabel: {
    fontSize: 9,
  },
});
