import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useEvents } from '@/api/queries';
import { EventCard } from '@/components/rows';
import { EmptyState, ErrorState, Header, ListSkeleton, Screen, SegmentedControl } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';

/** Activities: sessions with specialists, upcoming (including live ones) and past. */
export default function ActivitiesScreen() {
  const { t } = useI18n();
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const events = useEvents(when);

  return (
    <Screen scroll={false} header={<Header large title={t('activities.title')} />}>
      <View style={styles.tabs}>
        <SegmentedControl
          options={[
            { value: 'upcoming', label: t('activities.upcoming'), icon: 'calendar' },
            { value: 'past', label: t('activities.past'), icon: 'time' },
          ]}
          value={when}
          onChange={setWhen}
        />
      </View>
      {events.isPending ? (
        <View style={styles.padded}>
          <ListSkeleton count={3} height={170} />
        </View>
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : (
        <FlatList
          data={events.data}
          keyExtractor={(event) => event.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-clear-outline"
              text={when === 'upcoming' ? t('activities.emptyUpcoming') : t('activities.emptyPast')}
            />
          }
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push({ pathname: '/events/[id]', params: { id: item.id } })} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md - 4,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md - 4,
  },
});
