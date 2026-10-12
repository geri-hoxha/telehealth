import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useCallHistory, usePatients, useUnreadNotifications } from '@/api/queries';
import { useAuth, useUser } from '@/auth/AuthProvider';
import { CallRow } from '@/components/rows';
import { AppText, Avatar, Card, IconButton, ListGroup, ListRow, Screen, SectionHeader, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { pushNotificationsEnabled } from '@/notifications/push-config';
import { colors, gradients, radius, shadows, spacing } from '@/theme';

/** The doctor's start: ready for calls, a few numbers, and shortcuts. */
export default function DoctorHome() {
  const user = useUser();
  const { refreshUser } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  const history = useCallHistory();
  const patients = usePatients('');
  const unread = useUnreadNotifications();

  const today = new Date().toDateString();
  const callsToday = history.data?.filter((call) => new Date(call.createdAt).toDateString() === today).length ?? 0;

  const refresh = useMutation({
    mutationFn: async () => {
      await refreshUser();
      await queryClient.invalidateQueries();
    },
    onSuccess: () => showSnackbar({ message: t('doctorHome.profileRefreshed'), tone: 'success' }),
  });

  return (
    <Screen
      onRefresh={() => refresh.mutate()}
      refreshing={refresh.isPending}
      header={
        <View style={styles.header}>
          <Avatar name={`${user.firstName} ${user.lastName}`} url={user.avatarUrl} size={46} />
          <View style={styles.flex}>
            <AppText variant="caption" color={colors.textMuted}>
              {t('doctorHome.welcome')},
            </AppText>
            <AppText variant="headline" numberOfLines={1}>
              {t('common.doctorPrefix')} {user.firstName} {user.lastName}
            </AppText>
          </View>
          <IconButton
            icon="notifications-outline"
            label={t('home.notifications')}
            onPress={() => router.push('/notifications')}
            badge={unread.data?.count}
          />
        </View>
      }
    >
      <View style={styles.statusShadow}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.status}>
          <View style={styles.statusBubble} />
          <View style={styles.statusRow}>
            <LiveDot />
            <AppText variant="headline" color={colors.white}>
              {t('doctorHome.ready')}
            </AppText>
          </View>
          <AppText variant="caption" color="rgba(255,255,255,0.9)">
            {pushNotificationsEnabled ? t('doctorHome.readyText') : t('doctorHome.readyTextOpenApp')}
          </AppText>
          {user.doctorProfile?.specialty ? (
            <View style={styles.specialty}>
              <Ionicons name="medkit" size={14} color={colors.white} />
              <AppText variant="small" weight="700" color={colors.white}>
                {user.doctorProfile.specialty}
                {user.doctorProfile.healthCentre ? ` · ${user.doctorProfile.healthCentre}` : ''}
              </AppText>
            </View>
          ) : null}
        </LinearGradient>
      </View>

      <View style={styles.stats}>
        <Stat icon="call" value={callsToday} label={t('doctorHome.callsToday')} />
        <Stat icon="people" value={patients.data?.length ?? 0} label={t('doctorHome.patients')} />
      </View>

      <ListGroup title={t('doctorHome.shortcuts')}>
        <ListRow icon="time-outline" title={t('doctorHome.viewRecentCalls')} onPress={() => router.push('/doctor/calls')} />
        <ListRow
          icon="refresh"
          title={t('doctorHome.refreshProfile')}
          onPress={() => refresh.mutate()}
          disabled={refresh.isPending}
        />
      </ListGroup>

      {history.data?.length ? (
        <>
          <SectionHeader title={t('callTab.recent')} action={t('common.seeAll')} onAction={() => router.push('/doctor/calls')} />
          <View style={styles.list}>
            {history.data.slice(0, 3).map((call) => (
              <CallRow
                key={call.id}
                call={call}
                viewer="DOCTOR"
                onPress={() => router.push({ pathname: '/calls/[id]', params: { id: call.id } })}
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: 'call' | 'people'; value: number; label: string }) {
  return (
    <Card style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
    </Card>
  );
}

/** A softly pulsing green dot: this phone can ring. */
function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotPulse,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          },
        ]}
      />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  statusShadow: {
    borderRadius: radius.xl,
    ...shadows.raised,
  },
  status: {
    borderRadius: radius.xl,
    padding: spacing.lg - 4,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  statusBubble: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -60,
    top: -90,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  specialty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#86EFAC',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: colors.white,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md - 4,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  list: {
    gap: spacing.md - 4,
  },
});
