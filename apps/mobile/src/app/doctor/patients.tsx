import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { usePatients } from '@/api/queries';
import { PatientRow } from '@/components/rows';
import { EmptyState, ErrorState, Header, ListSkeleton, Screen, SearchField } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';

/** The doctor's patients, searchable by name, email, phone or personal ID. */
export default function PatientsScreen() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const patients = usePatients(debounced);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Screen scroll={false} header={<Header large title={t('patients.title')} />}>
      <View style={styles.search}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('patients.search')} />
      </View>
      {patients.isPending ? (
        <View style={styles.padded}>
          <ListSkeleton count={5} height={80} />
        </View>
      ) : patients.isError ? (
        <ErrorState error={patients.error} onRetry={() => void patients.refetch()} />
      ) : (
        <FlatList
          data={patients.data}
          keyExtractor={(patient) => patient.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={patients.isRefetching} onRefresh={() => void patients.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState icon="people-outline" text={debounced ? t('patients.noResults') : t('patients.empty')} />
          }
          renderItem={({ item }) => (
            <PatientRow patient={item} onPress={() => router.push({ pathname: '/patients/[id]', params: { id: item.id } })} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
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
