import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useClaims, useSubscription } from '@/api/queries';
import type { Claim, ClaimStatus } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { HealthCard } from '@/components/HealthCard';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  Screen,
  SectionHeader,
  Skeleton,
  type BadgeTone,
  type IconName,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney } from '@/i18n/format';
import { colors, radius, spacing } from '@/theme';

const CLAIM_LOOK: Record<ClaimStatus, { tone: BadgeTone; icon: IconName }> = {
  SUBMITTED: { tone: 'info', icon: 'paper-plane' },
  IN_REVIEW: { tone: 'warning', icon: 'hourglass' },
  APPROVED: { tone: 'success', icon: 'checkmark-circle' },
  REJECTED: { tone: 'danger', icon: 'close-circle' },
  PAID: { tone: 'primary', icon: 'cash' },
};

/** The digital health card and the patient's insurance claims. */
export default function HealthCardScreen() {
  const user = useUser();
  const { t } = useI18n();
  const subscription = useSubscription();
  const claims = useClaims();
  const active = subscription.data?.active;

  return (
    <Screen
      header={<Header title={t('healthCard.title')} />}
      onRefresh={() => {
        void subscription.refetch();
        void claims.refetch();
      }}
      refreshing={subscription.isRefetching || claims.isRefetching}
    >
      {subscription.isPending ? (
        <Skeleton height={210} rounded={radius.xl} />
      ) : active ? (
        <HealthCard holderName={`${user.firstName} ${user.lastName}`} subscription={active} />
      ) : (
        <Card style={styles.noCard}>
          <Ionicons name="card-outline" size={32} color={colors.textMuted} />
          <AppText variant="body" color={colors.textSecondary} align="center">
            {t('healthCard.noCard')}
          </AppText>
          <Button label={t('home.activate')} size="md" onPress={() => router.push('/subscription')} fullWidth={false} />
        </Card>
      )}

      <SectionHeader title={t('healthCard.claims')} />
      {claims.isPending ? (
        <ListSkeleton count={3} height={78} />
      ) : claims.isError ? (
        <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
      ) : claims.data.length ? (
        <View style={styles.list}>
          {claims.data.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} />
          ))}
        </View>
      ) : (
        <EmptyState icon="receipt-outline" text={t('healthCard.claimsEmpty')} />
      )}
    </Screen>
  );
}

function ClaimRow({ claim }: { claim: Claim }) {
  const { t, language } = useI18n();
  const look = CLAIM_LOOK[claim.status];
  return (
    <Card style={styles.claim}>
      <View style={styles.claimIcon}>
        <Ionicons name="receipt" size={20} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {claim.title}
        </AppText>
        <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
          {claim.number} · {formatDate(claim.submittedAt, language)}
          {claim.provider ? ` · ${claim.provider}` : ''}
        </AppText>
        <Badge label={t(`claimStatus.${claim.status}`)} tone={look.tone} icon={look.icon} style={styles.badge} />
      </View>
      <AppText variant="subhead">{formatMoney(claim.amount, claim.currency)}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  noCard: {
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingVertical: spacing.lg,
  },
  list: {
    gap: spacing.md - 4,
  },
  claim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  claimIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    marginTop: 4,
  },
});
