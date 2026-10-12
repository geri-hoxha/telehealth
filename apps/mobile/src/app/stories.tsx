import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, useWindowDimensions, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStories } from '@/api/queries';
import type { Story } from '@/api/types';
import { AppText, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { accent, colors, spacing } from '@/theme';

const STORY_MS = 6000;

/** Stories, full screen: swipe or tap the sides to move, they also advance on their own. */
export default function StoriesScreen() {
  const { start = '0' } = useLocalSearchParams<{ start: string }>();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stories = useStories().data ?? [];
  const list = useRef<FlatList<Story>>(null);
  const [index, setIndex] = useState(Math.max(0, Number(start) || 0));
  const progress = useRef(new Animated.Value(0)).current;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= stories.length) {
        router.back();
        return;
      }
      list.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    },
    [stories.length],
  );

  // Each story's progress bar fills, then the next story shows.
  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: STORY_MS, useNativeDriver: false });
    animation.start(({ finished }) => {
      if (finished) goTo(index + 1);
    });
    return () => animation.stop();
  }, [index, progress, goTo]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index !== null && first?.index !== undefined) setIndex(first.index);
  }).current;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <FlatList
        ref={list}
        data={stories}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={Math.min(index, Math.max(0, stories.length - 1))}
        getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
        keyExtractor={(story) => story.id}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <LinearGradient colors={accent(item.color)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.story, { width }]}>
            <View style={[styles.bubble, styles.bubbleOne]} />
            <View style={[styles.bubble, styles.bubbleTwo]} />
            <View style={styles.storyIcon}>
              <Ionicons name={item.icon as IconName} size={64} color={colors.white} />
            </View>
            <AppText variant="display" color={colors.white} align="center">
              {item.title}
            </AppText>
            <AppText variant="headline" weight="500" color="rgba(255,255,255,0.92)" align="center" style={styles.body}>
              {item.body}
            </AppText>
          </LinearGradient>
        )}
      />

      {/* Tap the left third to go back, the rest to go forward. */}
      <View style={[StyleSheet.absoluteFill, styles.taps]} pointerEvents="box-none">
        <Pressable style={styles.tapLeft} onPress={() => goTo(index - 1)} accessibilityLabel={t('common.back')} />
        <Pressable style={styles.tapRight} onPress={() => goTo(index + 1)} accessibilityLabel={t('common.continue')} />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {stories.map((story, storyIndex) => (
            <View key={story.id} style={styles.bar}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width:
                      storyIndex < index
                        ? '100%'
                        : storyIndex === index
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Ionicons name="medical" size={14} color={colors.primary} />
          </View>
          <AppText variant="caption" weight="700" color={colors.white} style={styles.flex}>
            Telehealth
          </AppText>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  flex: {
    flex: 1,
  },
  story: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  storyIcon: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    lineHeight: 28,
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bubbleOne: {
    width: 360,
    height: 360,
    top: -120,
    right: -140,
  },
  bubbleTwo: {
    width: 280,
    height: 280,
    bottom: -100,
    left: -120,
  },
  taps: {
    flexDirection: 'row',
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 2,
  },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.md - 4,
  },
  bars: {
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.white,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
