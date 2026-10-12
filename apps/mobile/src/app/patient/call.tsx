import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useCallHistory, useSubscription } from '@/api/queries';
import type { CallMedia } from '@/api/types';
import { startCall } from '@/calls/start-call';
import { CallRow } from '@/components/rows';
import { AppText, Button, Card, EmptyState, Header, ListSkeleton, Screen, SectionHeader, SegmentedControl } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, gradients, radius, shadows, spacing } from '@/theme';

const RECENT_COUNT = 3;

/** One button to call a doctor; the system picks the first free one. Recent calls below. */
export default function CallTab() {
  const { t } = useI18n();
  const [media, setMedia] = useState<CallMedia>('VIDEO');
  const subscription = useSubscription();
  const history = useCallHistory();
  const hasSubscription = !!subscription.data?.active;

  return (
    <Screen
      header={<Header large title={t('callTab.title')} subtitle={t('callTab.subtitle')} />}
      onRefresh={() => {
        void history.refetch();
        void subscription.refetch();
      }}
      refreshing={history.isRefetching}
    >
      <Card style={styles.callCard} padding={spacing.lg}>
        <BigCallButton
          disabled={!hasSubscription}
          label={t('callTab.button')}
          icon={media === 'VIDEO' ? 'videocam' : 'call'}
          onPress={() => startCall(media)}
        />
        <AppText variant="headline" align="center">
          {t('callTab.button')}
        </AppText>
        <SegmentedControl<CallMedia>
          options={[
            { value: 'VIDEO', label: t('callTab.video'), icon: 'videocam' },
            { value: 'AUDIO', label: t('callTab.audio'), icon: 'call' },
          ]}
          value={media}
          onChange={setMedia}
          style={styles.mediaToggle}
        />
        {!subscription.isPending && !hasSubscription ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle" size={20} color={colors.warning} />
            <AppText variant="caption" color={colors.textSecondary} style={styles.flex}>
              {t('callTab.needsSubscription')}
            </AppText>
            <Button label={t('home.activate')} size="sm" onPress={() => router.push('/subscription')} />
          </View>
        ) : null}
      </Card>

      <SectionHeader
        title={t('callTab.recent')}
        action={history.data?.length ? t('common.seeAll') : undefined}
        onAction={() => router.push('/calls')}
      />
      {history.isPending ? (
        <ListSkeleton count={2} height={74} />
      ) : history.data?.length ? (
        <View style={styles.list}>
          {history.data.slice(0, RECENT_COUNT).map((call) => (
            <CallRow
              key={call.id}
              call={call}
              viewer="PATIENT"
              onPress={() => router.push({ pathname: '/calls/[id]', params: { id: call.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon="call-outline" text={t('callTab.noCalls')} />
      )}
    </Screen>
  );
}

/** The large pulsing button. */
function BigCallButton({
  onPress,
  disabled,
  label,
  icon,
}: {
  onPress: () => void;
  disabled: boolean;
  label: string;
  icon: 'videocam' | 'call';
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (disabled) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, disabled]);

  const ring = (delay: number) => {
    const value = Animated.modulo(Animated.add(pulse, delay), 1);
    return {
      opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
      transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
    };
  };

  return (
    <View style={styles.bigWrap}>
      {!disabled ? (
        <>
          <Animated.View style={[styles.pulse, ring(0)]} />
          <Animated.View style={[styles.pulse, ring(0.5)]} />
        </>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [styles.bigShadow, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.big}>
          <Ionicons name={icon} size={52} color={colors.white} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const BIG = 132;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  callCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  bigWrap: {
    width: BIG * 1.7,
    height: BIG * 1.45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: BIG,
    height: BIG,
    borderRadius: BIG / 2,
    backgroundColor: colors.primary,
  },
  bigShadow: {
    borderRadius: BIG / 2,
    ...shadows.raised,
  },
  big: {
    width: BIG,
    height: BIG,
    borderRadius: BIG / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.4,
  },
  mediaToggle: {
    alignSelf: 'stretch',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    padding: spacing.md - 4,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  list: {
    gap: spacing.md - 4,
  },
});
