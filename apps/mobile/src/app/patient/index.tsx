import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useArticles, useBenefits, useStories, useSubscription, useUnreadNotifications } from '@/api/queries';
import type { Article, Benefit, Story } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { HealthCard } from '@/components/HealthCard';
import { AppText, Avatar, Card, GradientIcon, IconButton, Screen, SectionHeader, Skeleton, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { accent, colors, gradients, radius, shadows, spacing } from '@/theme';
import { useGreeting } from '@/utils/greeting';

export default function PatientHome() {
  const user = useUser();
  const { t } = useI18n();
  const greeting = useGreeting();
  const subscription = useSubscription();
  const unread = useUnreadNotifications();
  const stories = useStories();
  const benefits = useBenefits();
  const articles = useArticles();
  const active = subscription.data?.active ?? null;

  const refresh = () => {
    void subscription.refetch();
    void unread.refetch();
    void stories.refetch();
    void benefits.refetch();
    void articles.refetch();
  };

  return (
    <Screen
      onRefresh={refresh}
      refreshing={subscription.isRefetching || stories.isRefetching}
      header={
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/patient/profile')} accessibilityRole="button" style={styles.greeting}>
            <Avatar name={`${user.firstName} ${user.lastName}`} url={user.avatarUrl} size={46} />
            <View style={styles.flex}>
              <AppText variant="caption" color={colors.textMuted}>
                {greeting},
              </AppText>
              <AppText variant="headline" numberOfLines={1}>
                {user.firstName}
              </AppText>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push('/subscription')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.subscription')}
            style={[styles.planChip, !active && styles.planChipInactive]}
          >
            <Ionicons name={active ? 'shield-checkmark' : 'shield-outline'} size={16} color={active ? colors.primaryDark : colors.warning} />
            <AppText variant="small" weight="700" color={active ? colors.primaryDark : colors.warning} numberOfLines={1}>
              {active ? active.planName : t('home.activate')}
            </AppText>
          </Pressable>
          <IconButton
            icon="notifications-outline"
            label={t('home.notifications')}
            onPress={() => router.push('/notifications')}
            badge={unread.data?.count}
          />
        </View>
      }
    >
      <StoriesRow stories={stories.data} loading={stories.isPending} />

      {subscription.isPending ? (
        <Skeleton height={200} rounded={radius.xl} />
      ) : active ? (
        <Pressable onPress={() => router.push('/health-card')} accessibilityRole="button" accessibilityLabel={t('home.healthCard')}>
          <HealthCard holderName={`${user.firstName} ${user.lastName}`} subscription={active} />
        </Pressable>
      ) : (
        <ActivateCard />
      )}

      <Card onPress={() => router.push('/patient/call')} style={styles.callBanner}>
        <View style={styles.callIcon}>
          <Ionicons name="videocam" size={22} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subhead">{t('home.callBanner')}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t('home.callBannerText')}
          </AppText>
        </View>
        <Ionicons name="arrow-forward-circle" size={30} color={colors.primary} />
      </Card>

      <SectionHeader title={t('home.benefits')} />
      <BenefitsCarousel benefits={benefits.data} loading={benefits.isPending} />

      <SectionHeader title={t('home.articles')} />
      {articles.isPending ? (
        <View style={styles.list}>
          <Skeleton height={86} rounded={radius.lg} />
          <Skeleton height={86} rounded={radius.lg} />
        </View>
      ) : (
        <View style={styles.list}>
          {articles.data?.map((article) => <ArticleRow key={article.id} article={article} />)}
        </View>
      )}
    </Screen>
  );
}

function StoriesRow({ stories, loading }: { stories?: Story[]; loading: boolean }) {
  if (loading) {
    return (
      <View style={styles.storiesRow}>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} width={68} height={68} rounded={34} />
        ))}
      </View>
    );
  }
  if (!stories?.length) return null;
  return (
    <FlatList
      horizontal
      data={stories}
      keyExtractor={(story) => story.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.storiesList}
      style={styles.storiesBleed}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/stories', params: { start: String(index) } })}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          style={styles.story}
        >
          <LinearGradient colors={accent(item.color)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storyRing}>
            <View style={styles.storyGap}>
              <GradientIcon icon={item.icon} color={item.color} size={58} rounded={29} />
            </View>
          </LinearGradient>
          <AppText variant="small" weight="600" numberOfLines={1} align="center" style={styles.storyTitle}>
            {item.title}
          </AppText>
        </Pressable>
      )}
    />
  );
}

function ActivateCard() {
  const { t } = useI18n();
  return (
    <Pressable onPress={() => router.push('/subscription')} accessibilityRole="button" style={styles.activateShadow}>
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activate}>
        <View style={styles.activateBubble} />
        <View style={styles.activateIcon}>
          <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
        </View>
        <AppText variant="headline" color={colors.white}>
          {t('home.activateTitle')}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.9)">
          {t('home.activateText')}
        </AppText>
        <View style={styles.activateButton}>
          <AppText variant="caption" weight="800" color={colors.primaryDark}>
            {t('home.activate')}
          </AppText>
          <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function BenefitsCarousel({ benefits, loading }: { benefits?: Benefit[]; loading: boolean }) {
  if (loading) return <Skeleton height={150} rounded={radius.xl} />;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={BENEFIT_WIDTH + spacing.md - 4}
      decelerationRate="fast"
      contentContainerStyle={styles.benefits}
      style={styles.storiesBleed}
    >
      {benefits?.map((benefit) => (
        <Pressable
          key={benefit.id}
          onPress={() => router.push({ pathname: '/benefits/[id]', params: { id: benefit.id } })}
          accessibilityRole="button"
          accessibilityLabel={benefit.title}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LinearGradient colors={accent(benefit.color)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.benefit}>
            <View style={styles.benefitBubble} />
            <View style={styles.benefitIcon}>
              <Ionicons name={benefit.icon as IconName} size={22} color={colors.white} />
            </View>
            <View style={styles.benefitText}>
              <AppText variant="headline" color={colors.white} numberOfLines={2}>
                {benefit.title}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.9)" numberOfLines={1}>
                {benefit.subtitle}
              </AppText>
            </View>
          </LinearGradient>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const { t } = useI18n();
  return (
    <Card onPress={() => router.push({ pathname: '/articles/[id]', params: { id: article.id } })} style={styles.article}>
      <GradientIcon icon={article.icon} color={article.color} size={56} rounded={radius.lg} />
      <View style={styles.flex}>
        <AppText variant="subhead" numberOfLines={2}>
          {article.title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {article.summary}
        </AppText>
        <View style={styles.readTime}>
          <Ionicons name="time-outline" size={12} color={colors.primary} />
          <AppText variant="small" weight="700" color={colors.primary}>
            {t('home.readMinutes', { count: article.readMinutes })}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const BENEFIT_WIDTH = 250;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  greeting: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    maxWidth: 120,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  planChipInactive: {
    backgroundColor: colors.warningSoft,
  },
  storiesBleed: {
    marginHorizontal: -spacing.md,
  },
  storiesList: {
    paddingHorizontal: spacing.md,
    gap: spacing.md - 2,
  },
  storiesRow: {
    flexDirection: 'row',
    gap: spacing.md - 2,
  },
  story: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  storyRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 3,
  },
  storyGap: {
    flex: 1,
    borderRadius: 32,
    padding: 3,
    backgroundColor: colors.background,
  },
  storyTitle: {
    width: 72,
  },
  callBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  callIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md + 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateShadow: {
    borderRadius: radius.xl,
    ...shadows.raised,
  },
  activate: {
    borderRadius: radius.xl,
    padding: spacing.lg - 4,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  activateBubble: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -60,
    top: -80,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  activateIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md + 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  benefits: {
    paddingHorizontal: spacing.md,
    gap: spacing.md - 4,
  },
  benefit: {
    width: BENEFIT_WIDTH,
    height: 150,
    borderRadius: radius.xl,
    padding: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  benefitBubble: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -40,
    bottom: -60,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    gap: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  list: {
    gap: spacing.md - 4,
  },
  article: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    padding: spacing.md - 4,
  },
  readTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
});
