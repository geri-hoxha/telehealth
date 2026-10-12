import Ionicons from '@expo/vector-icons/Ionicons';
import * as CallKit from 'expo-callkit-telecom';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallDetail } from '@/api/queries';
import { invitationScreen } from '@/calls/active-call';
import { AppText, Avatar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { colors, gradients, radius, spacing } from '@/theme';

type Params = { sessionId: string; callId: string; media: string };

/**
 * Doctor, app open: the full-screen invitation for a ringing call, with the patient's name,
 * subscription plan and validity. Answer and Hang up go through the phone's call screen
 * (CallKit / Telecom), so CallCoordinator handles them like answers on the system screen.
 */
export default function IncomingCallScreen() {
  const { sessionId, callId, media } = useLocalSearchParams<Params>();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const call = useCallDetail(callId);
  const [busy, setBusy] = useState(false);
  const isVideo = media === 'VIDEO';
  const isInvite = call.data?.state === 'ACCEPTED';
  const patient = call.data?.patient;
  const plan = call.data?.patientPlan;

  // Closes when the ringing stops without an answer (hung up here or on the system screen, the
  // patient cancelled, or it moved on). An answer replaces this screen with the call instead.
  useEffect(() => {
    const close = (id: string) => {
      if (id !== sessionId || invitationScreen.get() !== sessionId) return;
      invitationScreen.set(null);
      if (router.canGoBack()) router.back();
    };
    const subscriptions = [
      CallKit.addCallEndedListener(({ id }) => close(id)),
      CallKit.addReportedCallEndedListener(({ id }) => close(id)),
      CallKit.addCallSessionRemovedListener(({ id }) => close(id)),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      if (invitationScreen.get() === sessionId) invitationScreen.set(null);
    };
  }, [sessionId]);

  const answer = () => {
    setBusy(true);
    void CallKit.answerCall(sessionId).catch(() => setBusy(false));
  };
  const hangUp = () => {
    setBusy(true);
    void CallKit.endCall(sessionId).catch(() => {
      invitationScreen.set(null);
      router.back();
    });
  };

  return (
    <LinearGradient colors={gradients.call} style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <View style={styles.kind}>
          <Ionicons name={isVideo ? 'videocam' : 'call'} size={16} color={colors.primarySoft} />
          <AppText variant="caption" weight="700" color={colors.primarySoft}>
            {isInvite ? t('incoming.invite') : isVideo ? t('incoming.video') : t('incoming.audio')}
          </AppText>
        </View>
        <Ripple>
          <Avatar name={patient?.name ?? '…'} url={patient?.avatarUrl} size={128} ring />
        </Ripple>
        <AppText variant="display" color={colors.white} align="center" numberOfLines={2}>
          {patient?.name ?? ' '}
        </AppText>

        <View style={styles.plan}>
          <View style={styles.planIcon}>
            <Ionicons name={plan ? 'shield-checkmark' : 'shield-outline'} size={22} color={plan ? colors.primarySoft : colors.warning} />
          </View>
          <View style={styles.flex}>
            <AppText variant="small" color="rgba(255,255,255,0.6)">
              {t('incoming.plan')}
            </AppText>
            <AppText variant="subhead" color={colors.white}>
              {plan ? plan.planName : t('incoming.noPlan')}
            </AppText>
            {plan ? (
              <AppText variant="caption" color="rgba(255,255,255,0.75)">
                {t('incoming.validity')}: {formatDate(plan.startsAt, language)} – {formatDate(plan.endsAt, language)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <CallAction icon="call" label={t('incoming.decline')} color={colors.hangUp} onPress={hangUp} disabled={busy} rotate />
        <CallAction icon={isVideo ? 'videocam' : 'call'} label={t('incoming.answer')} color={colors.answer} onPress={answer} disabled={busy} />
      </View>
    </LinearGradient>
  );
}

function Ripple({ children }: { children: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.ripple}>
      <Animated.View
        style={[
          styles.rippleRing,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
          },
        ]}
      />
      {children}
    </View>
  );
}

function CallAction({
  icon,
  label,
  color,
  onPress,
  disabled,
  rotate,
}: {
  icon: 'call' | 'videocam';
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
  rotate?: boolean;
}) {
  return (
    <View style={styles.action}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.actionButton, { backgroundColor: color }, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Ionicons name={icon} size={34} color={colors.white} style={rotate ? styles.rotate : undefined} />
      </Pressable>
      <AppText variant="subhead" color={colors.white}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  top: {
    alignItems: 'center',
    gap: spacing.md,
  },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ripple: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.answer,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    alignSelf: 'stretch',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  action: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotate: {
    transform: [{ rotate: '135deg' }],
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
