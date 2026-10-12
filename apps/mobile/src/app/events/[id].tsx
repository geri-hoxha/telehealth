import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { errorCode, errorMessage } from '@/api/errors';
import { queryKeys, useEvent } from '@/api/queries';
import { eventsApi } from '@/api/records';
import type { HealthEvent } from '@/api/types';
import { startCall } from '@/calls/start-call';
import { AppText, Avatar, Badge, Button, Card, ErrorState, Header, LoadingState, Screen, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatTime } from '@/i18n/format';
import { colors, gradients, radius, spacing } from '@/theme';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const event = useEvent(id);

  return (
    <Screen
      header={<Header title={t('activities.detail')} />}
      onRefresh={() => void event.refetch()}
      refreshing={event.isRefetching}
      footer={event.data ? <EventActions event={event.data} /> : undefined}
    >
      {event.isPending ? (
        <LoadingState />
      ) : event.isError ? (
        <ErrorState error={event.error} onRetry={() => void event.refetch()} />
      ) : (
        <EventDetails event={event.data} />
      )}
    </Screen>
  );
}

function EventDetails({ event }: { event: HealthEvent }) {
  const { t, language } = useI18n();
  const filled = event.capacity > 0 ? event.participantCount / event.capacity : 1;
  return (
    <>
      <LinearGradient
        colors={event.status === 'LIVE' ? ['#FB7185', '#E11D48'] : gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroBubble} />
        {event.status === 'LIVE' ? (
          <Badge label={t('activities.live')} tone="danger" dot style={styles.liveBadge} />
        ) : event.status === 'ENDED' ? (
          <Badge label={t('activities.ended')} tone="neutral" />
        ) : null}
        <AppText variant="title" color={colors.white}>
          {event.title}
        </AppText>
        <View style={styles.heroRow}>
          <Ionicons name="calendar" size={16} color={colors.white} />
          <AppText variant="bodyStrong" color={colors.white}>
            {formatDate(event.startsAt, language)}
          </AppText>
          <Ionicons name="time" size={16} color={colors.white} style={styles.heroIcon} />
          <AppText variant="bodyStrong" color={colors.white}>
            {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
          </AppText>
        </View>
      </LinearGradient>

      <Card style={styles.specialist}>
        <Avatar name={event.specialist.name} url={event.specialist.avatarUrl} size={52} />
        <View style={styles.flex}>
          <AppText variant="small" color={colors.textMuted}>
            {t('activities.specialist')}
          </AppText>
          <AppText variant="subhead">
            {t('common.doctorPrefix')} {event.specialist.name}
          </AppText>
          {event.specialist.specialty ? (
            <AppText variant="caption" color={colors.primaryDark}>
              {event.specialist.specialty}
            </AppText>
          ) : null}
        </View>
      </Card>

      <Card>
        <AppText variant="body" color={colors.textSecondary}>
          {event.description}
        </AppText>
      </Card>

      <Card style={styles.places}>
        <View style={styles.placesRow}>
          <Ionicons name="people" size={18} color={colors.primary} />
          <AppText variant="bodyStrong" style={styles.flex}>
            {t('activities.places')}
          </AppText>
          <AppText variant="bodyStrong" color={event.freePlaces === 0 ? colors.danger : colors.text}>
            {t('activities.placesOf', { taken: event.participantCount, capacity: event.capacity })}
          </AppText>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.min(100, filled * 100)}%` }, event.freePlaces === 0 && styles.barFull]} />
        </View>
        {event.joined ? <Badge label={t('activities.joined')} tone="success" icon="checkmark-circle" /> : null}
      </Card>

      {event.status === 'LIVE' && event.joined ? (
        <View style={styles.hint}>
          <Ionicons name="information-circle" size={18} color={colors.info} />
          <AppText variant="caption" color={colors.textSecondary} style={styles.flex}>
            {t('activities.requestCallHint')}
          </AppText>
        </View>
      ) : null}
    </>
  );
}

function EventActions({ event }: { event: HealthEvent }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();

  const onError = (error: unknown) =>
    showSnackbar({
      message: errorMessage(error, t),
      tone: 'error',
      action:
        errorCode(error) === 'SUBSCRIPTION_REQUIRED'
          ? { label: t('home.activate'), onPress: () => router.push('/subscription') }
          : undefined,
    });

  const join = useMutation({
    mutationFn: () => eventsApi.join(event.id),
    onSuccess: () => showSnackbar({ message: t('activities.joinedToast'), tone: 'success' }),
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.events }),
  });
  const leave = useMutation({
    mutationFn: () => eventsApi.leave(event.id),
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.events }),
  });

  if (event.status === 'ENDED') {
    return <Button label={t('activities.ended')} variant="outline" disabled onPress={() => {}} />;
  }
  if (event.joined) {
    const confirmLeave = () =>
      Alert.alert(t('activities.leave'), t('activities.leaveConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('activities.leave'), style: 'destructive', onPress: () => leave.mutate() },
      ]);
    return (
      <View style={styles.actions}>
        {event.status === 'LIVE' ? (
          <Button label={t('activities.requestCall')} icon="call" onPress={() => startCall('VIDEO', { eventId: event.id })} />
        ) : null}
        <Button
          label={t('activities.leave')}
          variant={event.status === 'LIVE' ? 'ghost' : 'outline'}
          onPress={confirmLeave}
          loading={leave.isPending}
        />
      </View>
    );
  }
  if (event.freePlaces === 0) {
    return <Button label={t('activities.full')} variant="dangerSoft" icon="close-circle" disabled onPress={() => {}} />;
  }
  return <Button label={t('activities.join')} icon="add-circle" onPress={() => join.mutate()} loading={join.isPending} />;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg - 4,
    gap: spacing.sm + 2,
    overflow: 'hidden',
  },
  heroBubble: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -90,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  liveBadge: {
    backgroundColor: colors.white,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroIcon: {
    marginLeft: spacing.sm,
  },
  specialist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  places: {
    gap: spacing.md - 4,
  },
  placesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  barFull: {
    backgroundColor: colors.danger,
  },
  hint: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md - 4,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
  },
  actions: {
    gap: spacing.sm,
  },
});
