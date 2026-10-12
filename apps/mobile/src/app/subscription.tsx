import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { queryKeys, useSubscription } from '@/api/queries';
import { subscriptionApi } from '@/api/records';
import { POLICY_TYPES, type PolicyType, type Subscription } from '@/api/types';
import {
  AppText,
  Badge,
  Button,
  Card,
  ChipGroup,
  Header,
  LoadingState,
  Screen,
  SectionHeader,
  TextField,
  useSnackbar,
  type IconName,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { colors, radius, spacing } from '@/theme';

type Way = 'insurance' | 'prepaid' | 'demo';

/** "My registration": the subscription status, and the three ways to activate one. */
export default function SubscriptionScreen() {
  const { t } = useI18n();
  const subscription = useSubscription();
  const [open, setOpen] = useState<Way | null>(null);
  const data = subscription.data;

  return (
    <Screen
      keyboard
      header={<Header title={t('subscription.title')} />}
      onRefresh={() => void subscription.refetch()}
      refreshing={subscription.isRefetching}
    >
      {subscription.isPending || !data ? (
        <LoadingState />
      ) : (
        <>
          <StatusCard active={data.active} />
          <SectionHeader title={t('subscription.ways')} />
          <Way
            icon="shield-checkmark"
            title={t('subscription.insuranceTitle')}
            text={t('subscription.insuranceText')}
            open={open === 'insurance'}
            onToggle={() => setOpen(open === 'insurance' ? null : 'insurance')}
          >
            <InsuranceForm onDone={() => setOpen(null)} />
          </Way>
          <Way
            icon="pricetag"
            title={t('subscription.prepaidTitle')}
            text={t('subscription.prepaidText')}
            open={open === 'prepaid'}
            onToggle={() => setOpen(open === 'prepaid' ? null : 'prepaid')}
          >
            <PrepaidForm onDone={() => setOpen(null)} />
          </Way>
          {data.demoAvailable ? (
            <Way
              icon="sparkles"
              title={t('subscription.demoTitle')}
              text={t('subscription.demoText')}
              open={open === 'demo'}
              onToggle={() => setOpen(open === 'demo' ? null : 'demo')}
            >
              <DemoRequest onDone={() => setOpen(null)} />
            </Way>
          ) : null}

          {data.history.length ? (
            <>
              <SectionHeader title={t('subscription.history')} />
              <View style={styles.list}>
                {data.history.map((item) => (
                  <HistoryRow key={item.id} subscription={item} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function StatusCard({ active }: { active: Subscription | null }) {
  const { t, language } = useI18n();
  return (
    <Card style={[styles.status, active ? styles.statusActive : styles.statusInactive]}>
      <View style={[styles.statusIcon, { backgroundColor: active ? colors.primary : colors.warning }]}>
        <Ionicons name={active ? 'shield-checkmark' : 'shield-outline'} size={26} color={colors.white} />
      </View>
      <View style={styles.flex}>
        {active ? (
          <>
            <Badge label={t('subscription.active')} tone="success" dot />
            <AppText variant="headline">{active.planName}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {t(`subscription.source.${active.source}`)} · {t('subscription.validUntil', { date: formatDate(active.endsAt, language) })}
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="headline">{t('subscription.noneTitle')}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {t('subscription.noneText')}
            </AppText>
          </>
        )}
      </View>
    </Card>
  );
}

function Way({
  icon,
  title,
  text,
  open,
  onToggle,
  children,
}: {
  icon: IconName;
  title: string;
  text: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card padding={0} style={[styles.way, open && styles.wayOpen]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.wayHeader}>
        <View style={styles.wayIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subhead">{title}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {text}
          </AppText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {open ? <View style={styles.wayBody}>{children}</View> : null}
    </Card>
  );
}

/** Shared by the three forms: refresh the subscription, say so, and close the form. */
function useActivation<T>(mutationFn: (input: T) => Promise<unknown>, onDone: () => void) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      showSnackbar({ message: t('subscription.activated'), tone: 'success', icon: 'shield-checkmark' });
      onDone();
    },
  });
}

function InsuranceForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [type, setType] = useState<PolicyType>('HEALTH');
  const [cardNumber, setCardNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const activate = useActivation(() => subscriptionApi.activateInsurance(type, cardNumber.replace(/[\s-]+/g, '')), onDone);
  const valid = /^[A-Za-z0-9]{6,24}$/.test(cardNumber.replace(/[\s-]+/g, ''));

  return (
    <>
      <AppText variant="caption" weight="600" color={colors.textSecondary}>
        {t('subscription.policyType')}
      </AppText>
      <ChipGroup<PolicyType>
        options={POLICY_TYPES.map((value) => ({ value, label: t(`policyType.${value}`) }))}
        value={type}
        onChange={setType}
      />
      <TextField
        label={t('subscription.cardNumber')}
        icon="card-outline"
        placeholder="4021 8830 1123 0059"
        value={cardNumber}
        onChangeText={setCardNumber}
        keyboardType="number-pad"
        error={submitted && !valid ? t('subscription.cardNumberInvalid') : undefined}
      />
      {activate.isError ? <FormMessage error={activate.error} /> : null}
      <Button
        label={t('subscription.activate')}
        loading={activate.isPending}
        onPress={() => {
          setSubmitted(true);
          if (valid) activate.mutate(undefined);
        }}
      />
    </>
  );
}

function PrepaidForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const redeem = useActivation(() => subscriptionApi.redeemPrepaid(code.replace(/[\s-]+/g, '')), onDone);
  const valid = /^[A-Za-z0-9]{4,24}$/.test(code.replace(/[\s-]+/g, ''));

  return (
    <>
      <TextField
        label={t('subscription.code')}
        icon="pricetag-outline"
        placeholder="TH-30-DEMO"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        error={submitted && !valid ? t('subscription.codeInvalid') : undefined}
      />
      {redeem.isError ? <FormMessage error={redeem.error} /> : null}
      <Button
        label={t('subscription.redeem')}
        loading={redeem.isPending}
        onPress={() => {
          setSubmitted(true);
          if (valid) redeem.mutate(undefined);
        }}
      />
    </>
  );
}

function DemoRequest({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const request = useActivation(() => subscriptionApi.requestDemo(), onDone);
  return (
    <>
      {request.isError ? <FormMessage error={request.error} /> : null}
      <Button label={t('subscription.demoRequest')} icon="sparkles" loading={request.isPending} onPress={() => request.mutate(undefined)} />
    </>
  );
}

function FormMessage({ error }: { error: unknown }) {
  const { t } = useI18n();
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <AppText variant="caption" color={colors.danger} style={styles.flex}>
        {errorMessage(error, t)}
      </AppText>
    </View>
  );
}

function HistoryRow({ subscription }: { subscription: Subscription }) {
  const { t, language } = useI18n();
  return (
    <Card style={styles.history}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{subscription.planName}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {t(`subscription.source.${subscription.source}`)} · {formatDate(subscription.startsAt, language)} –{' '}
          {formatDate(subscription.endsAt, language)}
        </AppText>
      </View>
      {subscription.isActive ? <Badge label={t('subscription.active')} tone="success" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  status: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  statusActive: {
    borderColor: colors.primarySoft,
  },
  statusInactive: {
    borderColor: colors.warningSoft,
  },
  statusIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  way: {
    overflow: 'hidden',
  },
  wayOpen: {
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
  },
  wayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    padding: spacing.md,
  },
  wayIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayBody: {
    gap: spacing.md - 4,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md - 4,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  list: {
    gap: spacing.sm,
  },
  history: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 4,
  },
});
