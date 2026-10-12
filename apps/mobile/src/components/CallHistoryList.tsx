import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { callsApi } from '@/api/calls';
import { queryKeys } from '@/api/queries';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';
import { CallRow } from './rows';
import { EmptyState, ErrorState, ListSkeleton } from './ui';

const PAGE_SIZE = 30;

/** Call history, newest first, loading older calls while scrolling. */
export function CallHistoryList({ viewer, onOpen }: { viewer: 'PATIENT' | 'DOCTOR'; onOpen: (callId: string) => void }) {
  const { t } = useI18n();
  const history = useInfiniteQuery({
    queryKey: [...queryKeys.callHistory, 'all'],
    queryFn: ({ pageParam }) => callsApi.history(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.length === PAGE_SIZE ? page[page.length - 1].createdAt : undefined),
  });

  if (history.isPending) {
    return (
      <View style={styles.padded}>
        <ListSkeleton count={5} height={74} />
      </View>
    );
  }
  if (history.isError) {
    return <ErrorState error={history.error} onRetry={() => void history.refetch()} />;
  }

  return (
    <FlatList
      data={history.data.pages.flat()}
      keyExtractor={(call) => call.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      onEndReached={() => {
        if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl refreshing={history.isRefetching} onRefresh={() => void history.refetch()} tintColor={colors.primary} />
      }
      ListEmptyComponent={<EmptyState icon="call-outline" text={t('calls.empty')} />}
      ListFooterComponent={history.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
      renderItem={({ item }) => <CallRow call={item} viewer={viewer} onPress={() => onOpen(item.id)} />}
    />
  );
}

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md - 4,
  },
});
