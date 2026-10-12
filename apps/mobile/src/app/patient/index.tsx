import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useArticles, useBenefits, useStories, useSubscription, useUnreadNotifications } from '@/api/queries';
import type { Article, Benefit, Story } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { HealthCard } from '@/components/HealthCard';
import { AppText, Avatar, Button, Card, IconButton, Screen, SectionHeader, Skeleton, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { accentTone, colors, radius, spacing } from '@/theme';
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

      <Card onPress={() => router.push('/patient/call')} style={styles.banner}>
        <View style={styles.bannerIcon}>
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

      <Card onPress={() => router.push('/lab-results')} style={styles.banner}>
        <View style={[styles.bannerIcon, { backgroundColor: labTone.soft }]}>
          <Ionicons name="water" size={22} color={labTone.color} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subhead">{t('lab.link')}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t('lab.linkText')}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
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
      renderItem={({ item, index }) => {
        const tone = accentTone(item.color);
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/stories', params: { start: String(index) } })}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={styles.story}
          >
            <View style={[styles.storyRing, { borderColor: tone.color }]}>
              <View style={[styles.storyIcon, { backgroundColor: tone.soft }]}>
                <Ionicons name={item.icon as IconName} size={26} color={tone.color} />
              </View>
            </View>
            <AppText variant="small" weight="600" numberOfLines={1} align="center" style={styles.storyTitle}>
              {item.title}
            </AppText>
          </Pressable>
        );
      }}
    />
  );
}

function ActivateCard() {
  const { t } = useI18n();
  const open = () => router.push('/subscription');
  return (
    <Card onPress={open} style={styles.activate}>
      <View style={styles.tile}>
        <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
      </View>
      <AppText variant="headline">{t('home.activateTitle')}</AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {t('home.activateText')}
      </AppText>
      <Button label={t('home.activate')} size="sm" fullWidth={false} onPress={open} style={styles.activateButton} />
    </Card>
  );
}

function BenefitsCarousel({ benefits, loading }: { benefits?: Benefit[]; loading: boolean }) {
  if (loading) return <Skeleton height={140} rounded={radius.lg} />;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={BENEFIT_WIDTH + spacing.md - 4}
      decelerationRate="fast"
      contentContainerStyle={styles.benefits}
      style={styles.benefitsBleed}
    >
      {benefits?.map((benefit) => {
        const tone = accentTone(benefit.color);
        return (
          <Card
            key={benefit.id}
            onPress={() => router.push({ pathname: '/benefits/[id]', params: { id: benefit.id } })}
            accessibilityLabel={benefit.title}
            style={[styles.benefit, { backgroundColor: tone.soft }]}
          >
            <View style={[styles.tile, { backgroundColor: tone.color }]}>
              <Ionicons name={benefit.icon as IconName} size={22} color={colors.white} />
            </View>
            <View style={styles.benefitText}>
              <AppText variant="subhead" numberOfLines={2}>
                {benefit.title}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                {benefit.subtitle}
              </AppText>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const { t } = useI18n();
  const tone = accentTone(article.color);
  return (
    <Card onPress={() => router.push({ pathname: '/articles/[id]', params: { id: article.id } })} style={styles.article}>
      <View style={[styles.tile, styles.articleTile, { backgroundColor: tone.soft }]}>
        <Ionicons name={article.icon as IconName} size={26} color={tone.color} />
      </View>
      <View style={styles.flex}>
        <AppText variant="subhead" numberOfLines={2}>
          {article.title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {article.summary}
        </AppText>
        <View style={styles.readTime}>
          <Ionicons name="time-outline" size={12} color={tone.color} />
          <AppText variant="small" weight="700" color={tone.color}>
            {t('home.readMinutes', { count: article.readMinutes })}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const BENEFIT_WIDTH = 250;
const labTone = accentTone('coral');

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
    borderWidth: 2,
    borderColor: colors.primary,
  },
  storyIcon: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyTitle: {
    width: 72,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  bannerIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md + 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activate: {
    padding: spacing.lg - 4,
    gap: spacing.sm,
  },
  activateButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  // The vertical padding keeps the cards' shadows from being clipped by the scroll view.
  benefits: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md - 4,
  },
  benefitsBleed: {
    marginHorizontal: -spacing.md,
    marginVertical: -spacing.sm,
  },
  benefit: {
    width: BENEFIT_WIDTH,
    height: 140,
    justifyContent: 'space-between',
  },
  benefitText: {
    gap: 2,
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
  articleTile: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
  },
  readTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
});
