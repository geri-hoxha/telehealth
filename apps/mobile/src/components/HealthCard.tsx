import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Animated, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import type { Subscription } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatCardExpiry, formatCardNumber } from '@/i18n/format';
import { gradients, radius, shadows, spacing } from '@/theme';
import { AppText } from './ui';

/** ISO/IEC 7810 ID-1: the size of a bank card. */
const CARD_ASPECT_RATIO = 85.6 / 53.98;

/** Where each colour of `gradients.card` sits: light and dark bands look like brushed gold. */
const GOLD_STOPS = [0, 0.3, 0.55, 0.8, 1] as const;

/** Dark brown, as if pressed into the gold; the light line under it is the engraving's edge. */
const INK = '#4A3410';
const INK_MUTED = 'rgba(74, 52, 16, 0.78)';
const ENGRAVED = {
  textShadowColor: 'rgba(255, 255, 255, 0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 0,
} as const;

/** The slab under the card, which gives it a thickness. */
const EDGE_COLOR = '#8F6B22';
const EDGE_DEPTH = 5;

const MAX_TILT = 9;
const PERSPECTIVE = 900;
const GLINT_TRAVEL = 80;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * The card tilts toward a finger on it, like a real card pressed at one corner, and its glint
 * follows. These are plain touch events: they don't take the touch from a parent `Pressable`
 * or from the scroll view.
 */
function useTilt() {
  const [tilt] = useState(() => {
    const x = new Animated.Value(0);
    const y = new Animated.Value(0);
    return {
      x,
      y,
      rotateX: y.interpolate({ inputRange: [-1, 1], outputRange: [`${MAX_TILT}deg`, `${-MAX_TILT}deg`] }),
      rotateY: x.interpolate({ inputRange: [-1, 1], outputRange: [`${-MAX_TILT}deg`, `${MAX_TILT}deg`] }),
      glint: x.interpolate({ inputRange: [-1, 1], outputRange: [-GLINT_TRAVEL, GLINT_TRAVEL] }),
    };
  });

  const size = useRef({ width: 1, height: 1 });

  const aim = (x: number, y: number, bounciness = 0) => {
    Animated.parallel([
      Animated.spring(tilt.x, { toValue: x, speed: 40, bounciness, useNativeDriver: true }),
      Animated.spring(tilt.y, { toValue: y, speed: 40, bounciness, useNativeDriver: true }),
    ]).start();
  };
  const follow = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    aim(clamp((locationX / size.current.width) * 2 - 1), clamp((locationY / size.current.height) * 2 - 1));
  };
  const release = () => aim(0, 0, 10);

  return {
    tilt,
    onLayout: (event: LayoutChangeEvent) => {
      size.current = event.nativeEvent.layout;
    },
    touch: { onTouchStart: follow, onTouchMove: follow, onTouchEnd: release, onTouchCancel: release },
  };
}

/** The digital health card: shown while the subscription is active. */
export function HealthCard({ holderName, subscription }: { holderName: string; subscription: Subscription }) {
  const { t } = useI18n();
  const { tilt, onLayout, touch } = useTilt();
  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.stage, { transform: [{ perspective: PERSPECTIVE }, { rotateX: tilt.rotateX }, { rotateY: tilt.rotateY }] }]}
    >
      <View style={styles.edge} />
      <LinearGradient
        colors={gradients.card}
        locations={GOLD_STOPS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* The light comes from the top left: bright there, a little shade at the bottom right. */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.75, y: 0.75 }}
          style={styles.overlay}
        />
        <LinearGradient
          colors={['rgba(110, 72, 12, 0)', 'rgba(110, 72, 12, 0.3)']}
          start={{ x: 0.35, y: 0.35 }}
          end={{ x: 1, y: 1 }}
          style={styles.overlay}
        />
        <Animated.View style={[styles.glint, { transform: [{ translateX: tilt.glint }, { rotate: '24deg' }] }]}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Ionicons name="pulse" size={240} color="rgba(255, 255, 255, 0.14)" style={styles.watermark} />

        <View style={styles.top}>
          <View style={styles.brand}>
            <LinearGradient colors={['#FFF4CC', '#E5C26A', '#B98B35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
              <Ionicons name="medical" size={16} color={INK} />
            </LinearGradient>
            <View>
              <AppText variant="subhead" weight="800" color={INK} style={ENGRAVED}>
                {t('card.brand')}
              </AppText>
              <AppText variant="small" color={INK_MUTED}>
                {t(`subscription.source.${subscription.source}`)}
              </AppText>
            </View>
          </View>
          <View style={styles.plan}>
            <AppText variant="small" weight="800" color={INK} style={[styles.planText, ENGRAVED]} numberOfLines={1}>
              {subscription.planName.toUpperCase()}
            </AppText>
          </View>
        </View>

        <AppText style={[styles.number, ENGRAVED]} color={INK} accessibilityLabel={subscription.cardNumber}>
          {formatCardNumber(subscription.cardNumber)}
        </AppText>

        <View style={styles.bottom}>
          <View style={styles.holder}>
            <AppText variant="small" color={INK_MUTED} style={styles.label}>
              {t('card.holder')}
            </AppText>
            <AppText variant="bodyStrong" color={INK} numberOfLines={1} style={[styles.value, ENGRAVED]}>
              {holderName.toUpperCase()}
            </AppText>
          </View>
          <View style={styles.expiry}>
            <AppText variant="small" color={INK_MUTED} style={styles.label}>
              {t('card.validThru')}
            </AppText>
            <AppText variant="bodyStrong" color={INK} style={[styles.value, ENGRAVED]}>
              {formatCardExpiry(subscription.endsAt)}
            </AppText>
          </View>
        </View>

        {/* On top of everything, to read where the finger is. It doesn't claim the touch. */}
        <View style={styles.overlay} {...touch} />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    marginBottom: EDGE_DEPTH,
  },
  edge: {
    position: 'absolute',
    top: EDGE_DEPTH * 2,
    bottom: -EDGE_DEPTH,
    left: spacing.sm - 2,
    right: spacing.sm - 2,
    borderRadius: radius.xl,
    backgroundColor: EDGE_COLOR,
    ...shadows.raised,
    shadowColor: '#5C3F0B',
    shadowOpacity: 0.32,
  },
  card: {
    aspectRatio: CARD_ASPECT_RATIO,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.lg - 4,
    justifyContent: 'space-between',
    // A bevel: light on the edges facing the light, dark on the others.
    borderWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderLeftColor: 'rgba(255, 255, 255, 0.55)',
    borderBottomColor: 'rgba(110, 72, 12, 0.5)',
    borderRightColor: 'rgba(110, 72, 12, 0.3)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glint: {
    position: 'absolute',
    top: -120,
    bottom: -120,
    left: '50%',
    width: 70,
    marginLeft: -35,
  },
  watermark: {
    position: 'absolute',
    right: -30,
    top: 10,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.9)',
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomColor: 'rgba(110, 72, 12, 0.45)',
    borderRightColor: 'rgba(110, 72, 12, 0.3)',
  },
  plan: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(110, 72, 12, 0.1)',
    // Sunk into the card: dark edge above, light edge below.
    borderWidth: 1,
    borderTopColor: 'rgba(110, 72, 12, 0.4)',
    borderLeftColor: 'rgba(110, 72, 12, 0.25)',
    borderBottomColor: 'rgba(255, 255, 255, 0.6)',
    borderRightColor: 'rgba(255, 255, 255, 0.4)',
  },
  planText: {
    letterSpacing: 1.2,
  },
  number: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  holder: {
    flex: 1,
  },
  expiry: {
    alignItems: 'flex-end',
  },
  label: {
    marginBottom: 1,
  },
  value: {
    letterSpacing: 1,
  },
});
