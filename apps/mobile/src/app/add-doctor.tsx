import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { callsApi } from '@/api/calls';
import { errorMessage } from '@/api/errors';
import { useAvailableDoctors } from '@/api/queries';
import type { Person } from '@/api/types';
import { AppText, Avatar, Button, Card, EmptyState, ErrorState, Header, ListSkeleton, Screen, SearchField, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';

/** During a call, the answering doctor rings another free doctor into it. */
export default function AddDoctorScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const { t } = useI18n();
  const showSnackbar = useSnackbar();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const doctors = useAvailableDoctors(debounced);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const invite = useMutation({
    mutationFn: (doctor: Person) => callsApi.invite(callId, doctor.id),
    onSuccess: (_, doctor) => {
      showSnackbar({ message: t('addDoctor.invited', { name: `${t('common.doctorPrefix')} ${doctor.name}` }), tone: 'success', icon: 'call' });
      router.back();
    },
    onError: (error) => showSnackbar({ message: errorMessage(error, t), tone: 'error' }),
  });

  return (
    <Screen scroll={false} edges={['top', 'bottom']} header={<Header title={t('addDoctor.title')} back="close" />}>
      <View style={styles.search}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('addDoctor.search')} />
        <AppText variant="caption" color={colors.textMuted}>
          {t('addDoctor.subtitle')}
        </AppText>
      </View>
      {doctors.isPending ? (
        <View style={styles.padded}>
          <ListSkeleton count={4} height={74} />
        </View>
      ) : doctors.isError ? (
        <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />
      ) : (
        <FlatList
          data={doctors.data}
          keyExtractor={(doctor) => doctor.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon="people-outline" text={t('addDoctor.empty')} />}
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <View>
                <Avatar name={item.name} url={item.avatarUrl} size={46} />
                <View style={styles.online} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {t('common.doctorPrefix')} {item.name}
                </AppText>
                {item.specialty ? (
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {item.specialty}
                  </AppText>
                ) : null}
              </View>
              <Button
                label={t('call.addDoctor')}
                icon="call"
                size="sm"
                onPress={() => invite.mutate(item)}
                loading={invite.isPending && invite.variables?.id === item.id}
                disabled={invite.isPending}
              />
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  search: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md - 4,
    gap: spacing.sm,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  online: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
