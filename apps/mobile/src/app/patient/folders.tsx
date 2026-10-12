import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFolders } from '@/api/queries';
import { FolderCard } from '@/components/rows';
import { EmptyState, ErrorState, Header, ListSkeleton, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';

/** The patient's visit records, written by doctors. */
export default function FoldersScreen() {
  const { t } = useI18n();
  const folders = useFolders();

  return (
    <Screen scroll={false} header={<Header large title={t('folders.title')} />}>
      {folders.isPending ? (
        <View style={styles.padded}>
          <ListSkeleton count={3} height={150} />
        </View>
      ) : folders.isError ? (
        <ErrorState error={folders.error} onRetry={() => void folders.refetch()} />
      ) : (
        <FlatList
          data={folders.data}
          keyExtractor={(folder) => folder.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={folders.isRefetching} onRefresh={() => void folders.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={<EmptyState icon="folder-open-outline" text={t('folders.empty')} />}
          renderItem={({ item }) => (
            <FolderCard folder={item} onPress={() => router.push({ pathname: '/folders/[id]', params: { id: item.id } })} />
          )}
        />
      )}
    </Screen>
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
